import { Injectable } from 'graphql-modules';
import { format, addMinutes, subDays, parse, isAfter } from 'date-fns';
import type { Span } from '@sentry/types';
import { ClickHouse, RowOf } from './clickhouse-client';
import { calculateTimeWindow, maxResolution } from './helpers';
import type { DateRange } from '../../../shared/entities';
import { sentry } from '../../../shared/sentry';

function formatDate(date: Date): string {
  return format(addMinutes(date, date.getTimezoneOffset()), 'yyyy-MM-dd HH:mm:ss');
}

export interface Percentiles {
  p75: number;
  p90: number;
  p95: number;
  p99: number;
}

export interface ESPercentiles {
  '75.0': number;
  '90.0': number;
  '95.0': number;
  '99.0': number;
}

// Remove after ES is no longer used
function toESPercentiles(item: Percentiles | number[]): ESPercentiles {
  if (Array.isArray(item)) {
    return {
      '75.0': item[0],
      '90.0': item[1],
      '95.0': item[2],
      '99.0': item[3],
    };
  }

  return {
    '75.0': item.p75,
    '90.0': item.p90,
    '95.0': item.p95,
    '99.0': item.p99,
  };
}

function ensureNumber(value: number | string): number {
  if (typeof value === 'number') {
    return value;
  }

  return parseFloat(value);
}

function canUseHourlyAggTable({
  period,
  resolution = maxResolution,
}: {
  period?: DateRange;
  resolution?: number;
}): boolean {
  if (period) {
    const distance = period.to.getTime() - period.from.getTime();
    const distanceInHours = distance / 1000 / 60 / 60;

    // We can't show data in 90 time-windows from past 24 hours (based on hourly table)
    if (distanceInHours < resolution) {
      return false;
    }
  }

  return true;
}

const schemaCoordinatesDailyStartedAt = parse('2022-01-25 00:00:00', 'yyyy-MM-dd HH:mm:ss', new Date());

function canUseSchemaCoordinatesDailyTable(period?: DateRange): boolean {
  if (period) {
    return isAfter(period.from, schemaCoordinatesDailyStartedAt);
  }

  return false;
}

@Injectable({
  global: true,
})
export class OperationsReader {
  constructor(private clickHouse: ClickHouse) {}

  @sentry('OperationsReader.countField')
  async countField({
    type,
    field,
    argument,
    target,
    period,
  }: {
    type: string;
    field?: string;
    argument?: string;
    target: string;
    period: DateRange;
  }) {
    return this.countFields({
      target,
      period,
      fields: [{ type, field, argument }],
    }).then(r => r[this.makeId({ type, field, argument })]);
  }

  @sentry('OperationsReader.countFields')
  async countFields(
    {
      fields,
      target,
      period,
      operations,
    }: {
      fields: ReadonlyArray<{
        type: string;
        field?: string | null;
        argument?: string | null;
      }>;
      target: string | readonly string[];
      period: DateRange;
      operations?: readonly string[];
    },
    span?: Span
  ): Promise<Record<string, number>> {
    // Once we collect data from more than 30 days, we can leave on this part of code
    if (canUseSchemaCoordinatesDailyTable(period)) {
      const coordinates = fields.map(selector => this.makeId(selector));

      const res = await this.clickHouse.query<{
        total: string;
        coordinate: string;
      }>({
        query: `
          SELECT
            coordinate,
            sum(total) as total
          FROM schema_coordinates_daily
          ${this.createFilter({
            target,
            period,
            operations,
            extra: [`( coordinate IN ('${coordinates.join(`', '`)}') )`],
          })}
          GROUP BY coordinate
        `,
        queryId: 'count_fields_v2',
        timeout: 30_000,
        span,
      });

      const stats: Record<string, number> = {};
      for (const row of res.data) {
        stats[row.coordinate] = ensureNumber(row.total);
      }

      for (const selector of fields) {
        const key = this.makeId(selector);

        if (typeof stats[key] !== 'number') {
          stats[key] = 0;
        }
      }

      return stats;
    }

    // TODO: Remove after 2022-02-25

    const sep = `_${Math.random().toString(36).substr(2, 5)}_`;

    function createAlias(selector: { type: string; field?: string | null; argument?: string | null }) {
      return [selector.type, selector.field, selector.argument].filter(Boolean).join(sep);
    }

    function extractSelector(alias: string): {
      type: string;
      field?: string | null;
      argument?: string | null;
    } {
      const [type, field, argument] = alias.split(sep);

      return {
        type,
        field,
        argument,
      };
    }

    const counters: string[] = [];
    const conditions: string[] = [];

    for (const selector of fields) {
      const alias = createAlias(selector);
      const id = this.makeId(selector);

      counters.push(`sum(has(schema, '${id}')) as ${alias}`);
      conditions.push(`has(schema, '${id}')`);
    }

    const res = await this.clickHouse.query<{
      [key: string]: string;
    }>({
      query: `
        SELECT
          ${counters.join(', ')}
        FROM operations_new
        ${this.createFilter({
          target,
          period,
          operations,
          extra: [`( ${conditions.join(' OR ')} )`],
        })}
      `,
      queryId: 'count_fields',
      timeout: 60_000,
      span,
    });

    const row = res.data[0];
    const stats: Record<string, number> = {};

    Object.keys(row).forEach(alias => {
      const selector = extractSelector(alias);
      const total = ensureNumber(row[alias]);

      stats[this.makeId(selector)] = total;
    });

    for (const selector of fields) {
      const key = this.makeId(selector);

      if (typeof stats[key] !== 'number') {
        stats[key] = 0;
      }
    }

    return stats;
  }

  @sentry('OperationsReader.countOperations')
  async countOperations(
    {
      target,
      period,
      operations,
    }: {
      target: string | readonly string[];
      period?: DateRange;
      operations?: readonly string[];
    },
    span?: Span
  ): Promise<{
    total: number;
    ok: number;
    notOk: number;
  }> {
    const result = await this.clickHouse.query<{
      total: number;
      totalOk: number;
    }>(
      canUseHourlyAggTable({ period })
        ? {
            query: `
          SELECT 
            sum(total) as total,
            sum(total_ok) as totalOk
          FROM operations_new_hourly_mv
          ${this.createFilter({
            target,
            period,
            operations,
          })}
        `,
            queryId: 'count_operations_mv',
            timeout: 15_000,
            span,
          }
        : {
            query: `
          SELECT 
            count() as total,
            sum(ok) as totalOk
          FROM operations_new
          ${this.createFilter({
            target,
            period,
            operations,
          })}
        `,
            queryId: 'count_operations',
            timeout: 15_000,
            span,
          }
    );
    const total = ensureNumber(result.data[0].total);
    const totalOk = ensureNumber(result.data[0].totalOk);

    return {
      total,
      ok: totalOk,
      notOk: total - totalOk,
    };
  }

  @sentry('OperationsReader.countFailures')
  async countFailures({
    target,
    period,
    operations,
  }: {
    target: string;
    period: DateRange;
    operations?: readonly string[];
  }): Promise<number> {
    return this.countOperations({ target, period, operations }).then(r => r.notOk);
  }

  @sentry('OperationsReader.countUniqueDocuments')
  async countUniqueDocuments(
    {
      target,
      period,
      operations,
    }: {
      target: string;
      period: DateRange;
      operations?: readonly string[];
    },
    span?: Span
  ): Promise<
    Array<{
      document: string;
      operationHash?: string;
      operationName: string;
      kind: string;
      count: number;
      countOk: number;
      percentage: number;
    }>
  > {
    const result = await this.clickHouse.query<{
      total: string;
      totalOk: string;
      hash: string;
    }>(
      canUseHourlyAggTable({ period })
        ? {
            query: `
        SELECT 
          sum(total) as total,
          sum(total_ok) as totalOk,
          hash
        FROM operations_new_hourly_mv
        ${this.createFilter({
          target,
          period,
          operations,
        })}
        GROUP BY hash
      `,
            queryId: 'count_unique_documents_mv',
            timeout: 15_000,
            span,
          }
        : {
            query: `
        SELECT 
          count() as total,
          sum(ok) as totalOk,
          hash
        FROM operations_new
        ${this.createFilter({
          target,
          period,
          operations,
        })}
        GROUP BY hash
      `,
            queryId: 'count_unique_documents',
            timeout: 15_000,
            span,
          }
    );
    const total = result.data.reduce((sum, row) => sum + parseInt(row.total, 10), 0);

    const registryResult = await this.clickHouse.query<{
      name?: string;
      body: string;
      hash: string;
      operation: string;
    }>({
      query: `
        SELECT 
          name,
          body,
          hash,
          operation
        FROM operations_registry FINAL
          ${this.createFilter({
            target,
            operations,
          })}`,
      queryId: 'operations_registry',
      timeout: 15_000,
      span,
    });

    const operationsMap = new Map<string, RowOf<typeof registryResult>>();

    for (const row of registryResult.data) {
      operationsMap.set(row.hash, row);
    }

    return result.data.map(row => {
      const rowTotal = parseInt(row.total, 10);
      const rowTotalOk = parseInt(row.totalOk, 10);
      const op = operationsMap.get(row.hash);
      const { name, body, operation } = op ?? {
        name: 'missing',
        body: 'missing',
        operation: 'missing',
      };

      return {
        document: body,
        operationName: `${row.hash.substr(0, 4)}_${name ?? 'anonymous'}`,
        operationHash: row.hash,
        kind: operation,
        count: rowTotal,
        countOk: rowTotalOk,
        percentage: (rowTotal / total) * 100,
      };
    });
  }

  @sentry('OperationsReader.countUniqueClients')
  async countUniqueClients(
    {
      target,
      period,
      operations,
    }: {
      target: string;
      period: DateRange;
      operations?: readonly string[];
    },
    span?: Span
  ): Promise<
    Array<{
      name: string;
      count: number;
      percentage: number;
      versions: Array<{
        version: string;
        count: number;
        percentage: number;
      }>;
    }>
  > {
    const result = await this.clickHouse.query<{
      total: string;
      client_name: string;
      client_version: string;
    }>({
      query: `
      SELECT 
        COUNT(*) as total,
        client_name,
        client_version
      FROM operations_new
      ${this.createFilter({
        target,
        period,
        operations,
      })}
      GROUP BY client_name, client_version
    `,
      queryId: 'count_unique_clients',
      timeout: 15_000,
      span,
    });

    const total = result.data.reduce((sum, row) => sum + parseInt(row.total, 10), 0);

    const clientMap = new Map<
      string,
      {
        name: string;
        total: number;
        versions: Array<{
          total: number;
          version: string;
        }>;
      }
    >();

    for (const row of result.data) {
      const client_name = !row.client_name ? 'unknown' : row.client_name;
      const client_version = !row.client_version ? 'unknown' : row.client_version;

      if (!clientMap.has(client_name)) {
        clientMap.set(client_name, {
          name: client_name,
          total: 0,
          versions: [],
        });
      }

      const client = clientMap.get(client_name)!;

      client.total += ensureNumber(row.total);
      client.versions.push({
        total: ensureNumber(row.total),
        version: client_version,
      });
    }

    return Array.from(clientMap.values()).map(client => {
      return {
        name: client.name,
        versions: client.versions.map(version => ({
          version: version.version,
          count: version.total,
          percentage: (version.total / client.total) * 100,
        })),
        count: client.total,
        percentage: (client.total / total) * 100,
      };
    });
  }

  @sentry('OperationsReader.requestsOverTime')
  async requestsOverTime({
    target,
    period,
    resolution,
    operations,
  }: {
    target: string;
    period: DateRange;
    resolution: number;
    operations?: readonly string[];
  }) {
    const results = await this.getDurationAndCountOverTime({
      target,
      period,
      resolution,
      operations,
    });

    return results.map(row => ({
      date: row.date,
      value: row.total,
    }));
  }

  @sentry('OperationsReader.failuresOverTime')
  async failuresOverTime({
    target,
    period,
    resolution,
    operations,
  }: {
    target: string;
    period: DateRange;
    resolution: number;
    operations?: readonly string[];
  }) {
    const result = await this.getDurationAndCountOverTime({
      target,
      period,
      resolution,
      operations,
    });

    return result.map(row => ({
      date: row.date,
      value: row.total - row.totalOk,
    }));
  }

  @sentry('OperationsReader.durationOverTime')
  async durationOverTime({
    target,
    period,
    resolution,
    operations,
  }: {
    target: string;
    period: DateRange;
    resolution: number;
    operations?: readonly string[];
  }): Promise<
    Array<{
      date: any;
      duration: ESPercentiles;
    }>
  > {
    return this.getDurationAndCountOverTime({
      target,
      period,
      resolution,
      operations,
    });
  }

  @sentry('OperationsReader.durationHistogram')
  async durationHistogram(
    {
      target,
      period,
      operations,
    }: {
      target: string;
      period: DateRange;
      operations?: readonly string[];
    },
    span?: Span
  ): Promise<
    Array<{
      duration: number;
      count: number;
    }>
  > {
    const result = await this.clickHouse.query<{
      latency: number;
      total: number;
    }>({
      query: `
        WITH histogram(90)(logDuration) AS hist
        SELECT
            arrayJoin(hist).1 as latency,
            arrayJoin(hist).3 as total
        FROM
        (
            SELECT log10(duration) as logDuration
            FROM operations_new
            ${this.createFilter({ target, period, operations })}
        )
        ORDER BY latency
      `,
      queryId: 'duration_histogram',
      timeout: 60_000,
      span,
    });

    return result.data.map(row => {
      return {
        duration: Math.round(Math.pow(10, row.latency)),
        count: Math.round(row.total),
      };
    });
  }

  @sentry('OperationsReader.generalDurationPercentiles')
  async generalDurationPercentiles(
    {
      target,
      period,
      operations,
    }: {
      target: string;
      period: DateRange;
      operations?: readonly string[];
    },
    span?: Span
  ): Promise<ESPercentiles> {
    const result = await this.clickHouse.query<{
      percentiles: [number, number, number, number];
    }>(
      canUseHourlyAggTable({ period })
        ? {
            query: `
            SELECT 
              quantilesMerge(0.75, 0.90, 0.95, 0.99)(duration_quantiles) as percentiles
            FROM operations_new_hourly_mv
            ${this.createFilter({ target, period, operations })}
          `,
            queryId: 'general_duration_percentiles_mv',
            timeout: 15_000,
            span,
          }
        : {
            query: `
            SELECT 
              quantiles(0.75, 0.90, 0.95, 0.99)(duration) as percentiles
            FROM operations_new
            ${this.createFilter({ target, period, operations })}
          `,
            queryId: 'general_duration_percentiles',
            timeout: 15_000,
            span,
          }
    );

    return toESPercentiles(result.data[0].percentiles);
  }

  @sentry('OperationsReader.durationPercentiles')
  async durationPercentiles(
    {
      target,
      period,
      operations,
    }: {
      target: string;
      period: DateRange;
      operations?: readonly string[];
    },
    span?: Span
  ) {
    const result = await this.clickHouse.query<{
      hash: string;
      percentiles: [number, number, number, number];
    }>(
      canUseHourlyAggTable({ period })
        ? {
            query: `
        SELECT 
          hash,
          quantilesMerge(0.75, 0.90, 0.95, 0.99)(duration_quantiles) as percentiles
        FROM operations_new_hourly_mv
        ${this.createFilter({ target, period, operations })}
        GROUP BY hash
      `,
            queryId: 'duration_percentiles_mv',
            timeout: 15_000,
            span,
          }
        : {
            query: `
        SELECT 
          hash,
          quantiles(0.75, 0.90, 0.95, 0.99)(duration) as percentiles
        FROM operations_new
      ${this.createFilter({ target, period, operations })}
      GROUP BY hash
    `,
            queryId: 'duration_percentiles',
            timeout: 15_000,
            span,
          }
    );

    const collection = new Map<string, ESPercentiles>();

    result.data.forEach(row => {
      collection.set(row.hash, toESPercentiles(row.percentiles));
    });

    return collection;
  }

  @sentry('OperationsReader.getDurationAndCountOverTime')
  private async getDurationAndCountOverTime(
    {
      target,
      period,
      resolution,
      operations,
    }: {
      target: string;
      period: DateRange;
      resolution: number;
      operations?: readonly string[];
    },
    span?: Span
  ) {
    // multiply by 1000 to convert to milliseconds
    const result = await this.clickHouse.query<{
      date: number;
      total: number;
      totalOk: number;
      percentiles: [number, number, number, number];
    }>(
      canUseHourlyAggTable({ period })
        ? {
            query: `
          SELECT 
            multiply(
              toUnixTimestamp(
                toStartOfInterval(timestamp, INTERVAL ${this.clickHouse.translateWindow(
                  calculateTimeWindow({ period, resolution })
                )}, 'UTC'),
              'UTC'),
            1000) as date,
            quantilesMerge(0.75, 0.90, 0.95, 0.99)(duration_quantiles) as percentiles,
            sum(total) as total,
            sum(total_ok) as totalOk
          FROM operations_new_hourly_mv
          ${this.createFilter({ target, period, operations })}
          GROUP BY date
          ORDER BY date
      `,
            queryId: 'duration_and_count_over_time_mv',
            timeout: 15_000,
            span,
          }
        : {
            query: `
          SELECT 
            multiply(
              toUnixTimestamp(
                toStartOfInterval(timestamp, INTERVAL ${this.clickHouse.translateWindow(
                  calculateTimeWindow({ period, resolution })
                )}, 'UTC'),
              'UTC'),
            1000) as date,
            quantiles(0.75, 0.90, 0.95, 0.99)(duration) as percentiles,
            count(*) as total,
            sum(ok) as totalOk
          FROM operations_new
          ${this.createFilter({ target, period, operations })}
          GROUP BY date
          ORDER BY date
    `,
            queryId: 'duration_and_count_over_time',
            timeout: 15_000,
            span,
          }
    );

    return result.data.map(row => {
      return {
        date: ensureNumber(row.date) as any,
        total: ensureNumber(row.total),
        totalOk: ensureNumber(row.totalOk),
        duration: toESPercentiles(row.percentiles),
      };
    });
  }

  async getCoordinatesPerTarget({ target, daysLimit }: { target: string; daysLimit: number }): Promise<string[]> {
    const result = await this.clickHouse.query<{
      coordinate: string;
    }>({
      query: `
        SELECT coordinate FROM schema_coordinates_daily
        ${this.createFilter({ target, extra: [`timestamp >= subtractDays(NOW(), ${daysLimit})`] })}
        GROUP BY coordinate`,
      queryId: 'coordinates_per_target',
      timeout: 15_000,
    });

    return result.data.map(row => row.coordinate);
  }

  async adminCountOperationsPerTarget({ daysLimit }: { daysLimit: number }) {
    const result = await this.clickHouse.query<{
      total: string;
      target: string;
    }>({
      query: `SELECT sum(total) as total, target from operations_new_hourly_mv WHERE timestamp >= subtractDays(NOW(), ${daysLimit}) GROUP BY target`,
      queryId: 'admin_operations_per_target',
      timeout: 15_000,
    });

    return result.data.map(row => ({
      total: ensureNumber(row.total),
      target: row.target,
    }));
  }

  async adminOperationsOverTime({ daysLimit }: { daysLimit: number }) {
    const result = await this.clickHouse.query<{
      date: number;
      total: string;
    }>({
      query: `
        SELECT 
          multiply(
            toUnixTimestamp(
              toStartOfInterval(timestamp, INTERVAL ${this.clickHouse.translateWindow(
                calculateTimeWindow({
                  period: {
                    from: subDays(new Date(), daysLimit),
                    to: new Date(),
                  },
                  resolution: 90,
                })
              )}, 'UTC'),
            'UTC'),
          1000) as date,
          sum(total) as total
        FROM operations_new_hourly_mv
        WHERE timestamp >= subtractDays(NOW(), ${daysLimit})
        GROUP BY date
        ORDER BY date
      `,
      queryId: 'admin_operations_per_target',
      timeout: 15_000,
    });

    return result.data.map(row => ({
      date: ensureNumber(row.date) as any,
      total: ensureNumber(row.total),
    }));
  }

  public createFilter({
    target,
    period,
    operations,
    extra = [],
  }: {
    target?: string | readonly string[];
    period?: DateRange;
    operations?: readonly string[];
    extra?: string[];
  }) {
    const where: string[] = [];

    if (target) {
      if (Array.isArray(target)) {
        where.push(`target IN (${target.map(t => `'${t}'`).join(', ')})`);
      } else {
        where.push(`target = '${target}'`);
      }
    }

    if (period) {
      where.push(`timestamp >= toDateTime('${formatDate(period.from)}', 'UTC')`);
      where.push(`timestamp <= toDateTime('${formatDate(period.to)}', 'UTC')`);
    }

    if (operations?.length) {
      where.push(`(hash) IN (${operations.map(op => `'${op}'`).join(',')})`);
    }

    if (extra.length) {
      where.push(...extra);
    }

    const statement = where.length ? ` PREWHERE ${where.join(' AND ')} ` : ' ';

    return statement;
  }

  private makeId({ type, field, argument }: { type: string; field?: string | null; argument?: string | null }): string {
    return [type, field, argument].filter(Boolean).join('.');
  }
}
