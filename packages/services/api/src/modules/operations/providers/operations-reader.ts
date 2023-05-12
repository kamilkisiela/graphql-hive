import { addMinutes, differenceInDays, format } from 'date-fns';
import { Injectable } from 'graphql-modules';
import type { Span } from '@sentry/types';
import { batch } from '@theguild/buddy';
import type { DateRange } from '../../../shared/entities';
import { sentry } from '../../../shared/sentry';
import { ClickHouse, RowOf, sql } from './clickhouse-client';
import { calculateTimeWindow } from './helpers';
import { SqlValue } from './sql';

function formatDate(date: Date): string {
  return format(addMinutes(date, date.getTimezoneOffset()), 'yyyy-MM-dd HH:mm:ss');
}

export interface Percentiles {
  p75: number;
  p90: number;
  p95: number;
  p99: number;
}

function toPercentiles(item: Percentiles | number[]) {
  if (Array.isArray(item)) {
    return {
      p75: item[0],
      p90: item[1],
      p95: item[2],
      p99: item[3],
    };
  }

  return {
    p75: item.p75,
    p90: item.p90,
    p95: item.p95,
    p99: item.p99,
  };
}

function ensureNumber(value: number | string): number {
  if (typeof value === 'number') {
    return value;
  }

  return parseFloat(value);
}

function pickQueryByPeriod(
  queryMap: {
    hourly: {
      query: SqlValue;
      queryId: string;
      timeout: number;
      span?: Span | undefined;
    };
    daily: {
      query: SqlValue;
      queryId: string;
      timeout: number;
      span?: Span | undefined;
    };
    regular: {
      query: SqlValue;
      queryId: string;
      timeout: number;
      span?: Span | undefined;
    };
  },
  period: DateRange | null,
  resolution?: number,
) {
  if (!period) {
    return queryMap.daily;
  }

  const distance = period.to.getTime() - period.from.getTime();
  const distanceInHours = distance / 1000 / 60 / 60;
  const distanceInDays = distance / 1000 / 60 / 60 / 24;

  if (resolution) {
    if (distanceInDays >= resolution) {
      return queryMap.daily;
    }

    if (distanceInHours >= resolution) {
      return queryMap.hourly;
    }

    return queryMap.regular;
  }

  if (distanceInHours > 24) {
    return queryMap.daily;
  }

  if (distanceInHours > 1) {
    return queryMap.hourly;
  }

  return queryMap.regular;
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
      excludedClients,
    }: {
      fields: ReadonlyArray<{
        type: string;
        field?: string | null;
        argument?: string | null;
      }>;
      target: string | readonly string[];
      period: DateRange;
      operations?: readonly string[];
      excludedClients?: readonly string[];
    },
    span?: Span,
  ): Promise<Record<string, number>> {
    const coordinates = fields.map(selector => this.makeId(selector));
    const conditions = [sql`(coordinate IN (${sql.array(coordinates, 'String')}))`];

    if (Array.isArray(excludedClients) && excludedClients.length > 0) {
      // Eliminate coordinates fetched by excluded clients.
      // We can connect a coordinate to a client by using the hash column.
      // The hash column is basically a unique identifier of a GraphQL operation.
      conditions.push(sql`
        hash NOT IN (
          SELECT hash FROM clients_daily ${this.createFilter({
            target,
            period,
            extra: [sql`client_name IN (${sql.array(excludedClients, 'String')})`],
          })} GROUP BY hash
        )
      `);
    }

    const res = await this.clickHouse.query<{
      total: string;
      coordinate: string;
    }>({
      query: sql`
            SELECT
              coordinate,
              sum(total) as total
            FROM coordinates_daily
            ${this.createFilter({
              target,
              period,
              operations,
              extra: conditions,
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
    span?: Span,
  ): Promise<{
    total: number;
    ok: number;
    notOk: number;
  }> {
    const query = pickQueryByPeriod(
      {
        daily: {
          query: sql`SELECT sum(total) as total, sum(total_ok) as totalOk FROM operations_daily ${this.createFilter(
            {
              target,
              period,
              operations,
            },
          )}`,
          queryId: 'count_operations_daily',
          timeout: 10_000,
          span,
        },
        hourly: {
          query: sql`SELECT sum(total) as total, sum(total_ok) as totalOk FROM operations_hourly ${this.createFilter(
            {
              target,
              period,
              operations,
            },
          )}`,
          queryId: 'count_operations_hourly',
          timeout: 15_000,
          span,
        },
        regular: {
          query: sql`SELECT count() as total, sum(ok) as totalOk FROM operations ${this.createFilter(
            {
              target,
              period,
              operations,
            },
          )}`,
          queryId: 'count_operations_regular',
          timeout: 30_000,
          span,
        },
      },
      period ?? null,
    );

    const result = await this.clickHouse.query<{
      total: number;
      totalOk: number;
    }>(query);

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
    span?: Span,
  ): Promise<number> {
    const query = pickQueryByPeriod(
      {
        daily: {
          query: sql`
            SELECT count(distinct hash) as total
            FROM operations_daily
            ${this.createFilter({
              target,
              period,
              operations,
            })}
          `,
          queryId: 'count_unique_documents_daily',
          timeout: 10_000,
          span,
        },
        hourly: {
          query: sql`
            SELECT count(distinct hash) as total
            FROM operations_hourly
            ${this.createFilter({
              target,
              period,
              operations,
            })}
          `,
          queryId: 'count_unique_documents_hourly',
          timeout: 15_000,
          span,
        },
        regular: {
          query: sql`
            SELECT count(distinct hash) as total
            FROM operations
            ${this.createFilter({
              target,
              period,
              operations,
            })}
          `,
          queryId: 'count_unique_documents',
          timeout: 15_000,
          span,
        },
      },
      period,
    );

    const result = await this.clickHouse.query<{
      total: string;
    }>(query);

    return result.data.length ? parseInt(result.data[0].total, 10) : 0;
  }

  @sentry('OperationsReader.readUniqueDocuments')
  async readUniqueDocuments(
    {
      target,
      period,
      operations,
    }: {
      target: string;
      period: DateRange;
      operations?: readonly string[];
    },
    span?: Span,
  ): Promise<
    Array<{
      operationHash?: string;
      operationName: string;
      kind: string;
      count: number;
      countOk: number;
      percentage: number;
    }>
  > {
    const query = pickQueryByPeriod(
      {
        daily: {
          query: sql`
            SELECT sum(total) as total, sum(total_ok) as totalOk, hash 
            FROM operations_daily
            ${this.createFilter({
              target,
              period,
              operations,
            })}
            GROUP BY hash
          `,
          queryId: 'read_unique_documents_daily',
          timeout: 10_000,
          span,
        },
        hourly: {
          query: sql`
            SELECT 
              sum(total) as total,
              sum(total_ok) as totalOk,
              hash
            FROM operations_hourly
            ${this.createFilter({
              target,
              period,
              operations,
            })}
            GROUP BY hash
          `,
          queryId: 'read_unique_documents_hourly',
          timeout: 15_000,
          span,
        },
        regular: {
          query: sql`
            SELECT count() as total, sum(ok) as totalOk, hash
            FROM operations
            ${this.createFilter({
              target,
              period,
              operations,
            })}
            GROUP BY hash
          `,
          queryId: 'read_unique_documents',
          timeout: 15_000,
          span,
        },
      },
      period,
    );

    const [operationsResult, registryResult] = await Promise.all([
      this.clickHouse.query<{
        total: string;
        totalOk: string;
        hash: string;
      }>(query),
      this.clickHouse.query<{
        name?: string;
        hash: string;
        operation_kind: string;
      }>({
        query: sql`
          SELECT 
            name,
            hash,
            operation_kind
          FROM operation_collection
            ${this.createFilter({
              target,
              operations,
              period,
            })}
          GROUP BY name, hash, operation_kind`,
        queryId: 'operations_registry',
        timeout: 15_000,
        span,
      }),
    ]);

    const total = operationsResult.data.reduce((sum, row) => sum + parseInt(row.total, 10), 0);

    const operationsMap = new Map<string, RowOf<typeof registryResult>>();

    for (const row of registryResult.data) {
      operationsMap.set(row.hash, row);
    }

    return operationsResult.data.map(row => {
      const rowTotal = parseInt(row.total, 10);
      const rowTotalOk = parseInt(row.totalOk, 10);
      const op = operationsMap.get(row.hash);
      const { name, operation_kind } = op ?? {
        name: 'missing',
        operation_kind: 'missing',
      };

      return {
        operationName: `${row.hash.substr(0, 4)}_${name ?? 'anonymous'}`,
        operationHash: row.hash,
        kind: operation_kind,
        count: rowTotal,
        countOk: rowTotalOk,
        percentage: (rowTotal / total) * 100,
      };
    });
  }

  @sentry('OperationsReader.readOperationBody')
  async readOperationBody(
    {
      target,
      hash,
    }: {
      target: string;
      hash: string;
    },
    span?: Span,
  ) {
    const result = await this.clickHouse.query<{
      body: string;
    }>({
      query: sql`
        SELECT 
          body
        FROM operation_collection
          ${this.createFilter({
            target,
            extra: [sql`hash = ${hash}`],
          })}
        LIMIT 1
      `,
      queryId: 'read_body',
      timeout: 10_000,
      span,
    });

    return result.data.length ? result.data[0].body : null;
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
    span?: Span,
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
    }>(
      pickQueryByPeriod(
        {
          daily: {
            query: sql`
              SELECT 
                sum(total) as total,
                client_name,
                client_version
              FROM clients_daily
              ${this.createFilter({
                target,
                period,
                operations,
              })}
              GROUP BY client_name, client_version
            `,
            queryId: 'count_clients_daily',
            timeout: 10_000,
            span,
          },
          hourly: {
            query: sql`
              SELECT 
                count(*) as total,
                client_name,
                client_version
              FROM operations
              ${this.createFilter({
                target,
                period,
                operations,
              })}
              GROUP BY client_name, client_version
            `,
            queryId: 'count_clients_hourly',
            timeout: 10_000,
            span,
          },
          regular: {
            query: sql`
              SELECT 
                count(*) as total,
                client_name,
                client_version
              FROM operations
              ${this.createFilter({
                target,
                period,
                operations,
              })}
              GROUP BY client_name, client_version
            `,
            queryId: 'count_clients_regular',
            timeout: 10_000,
            span,
          },
        },
        period,
      ),
    );

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

  @sentry('OperationsReader.readUniqueClientNames')
  async readUniqueClientNames(
    {
      target,
      period,
      operations,
    }: {
      target: string | readonly string[];
      period: DateRange;
      operations?: readonly string[];
    },
    span?: Span,
  ): Promise<
    Array<{
      name: string;
      count: number;
    }>
  > {
    const result = await this.clickHouse.query<{
      count: string;
      client_name: string;
    }>({
      query: sql`
        SELECT 
          sum(total) as count,
          client_name
        FROM clients_daily
        ${this.createFilter({
          target,
          period,
          operations,
          extra: [sql`notEmpty(client_name)`],
        })}
        GROUP BY client_name
      `,
      queryId: 'count_client_names',
      timeout: 10_000,
      span,
    });

    return result.data.map(row => {
      return {
        name: row.client_name,
        count: ensureNumber(row.count),
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
      duration: Percentiles;
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
    span?: Span,
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
      query: sql`
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
    span?: Span,
  ): Promise<Percentiles> {
    const result = await this.clickHouse.query<{
      percentiles: [number, number, number, number];
    }>(
      pickQueryByPeriod(
        {
          daily: {
            query: sql`
              SELECT 
                quantilesMerge(0.75, 0.90, 0.95, 0.99)(duration_quantiles) as percentiles
              FROM operations_daily
              ${this.createFilter({ target, period, operations })}
            `,
            queryId: 'general_duration_percentiles_daily',
            timeout: 15_000,
            span,
          },
          hourly: {
            query: sql`
              SELECT 
                quantilesMerge(0.75, 0.90, 0.95, 0.99)(duration_quantiles) as percentiles
              FROM operations_hourly
              ${this.createFilter({ target, period, operations })}
            `,
            queryId: 'general_duration_percentiles_hourly',
            timeout: 15_000,
            span,
          },
          regular: {
            query: sql`
              SELECT 
                quantiles(0.75, 0.90, 0.95, 0.99)(duration) as percentiles
              FROM operations
              ${this.createFilter({ target, period, operations })}
            `,
            queryId: 'general_duration_percentiles_regular',
            timeout: 15_000,
            span,
          },
        },
        period,
      ),
    );

    return toPercentiles(result.data[0].percentiles);
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
    span?: Span,
  ) {
    const result = await this.clickHouse.query<{
      hash: string;
      percentiles: [number, number, number, number];
    }>(
      pickQueryByPeriod(
        {
          daily: {
            query: sql`
              SELECT 
                hash,
                quantilesMerge(0.75, 0.90, 0.95, 0.99)(duration_quantiles) as percentiles
              FROM operations_daily
              ${this.createFilter({ target, period, operations })}
              GROUP BY hash
            `,
            queryId: 'duration_percentiles_daily',
            timeout: 15_000,
            span,
          },
          hourly: {
            query: sql`
              SELECT 
                hash,
                quantilesMerge(0.75, 0.90, 0.95, 0.99)(duration_quantiles) as percentiles
              FROM operations_hourly
              ${this.createFilter({ target, period, operations })}
              GROUP BY hash
            `,
            queryId: 'duration_percentiles_hourly',
            timeout: 15_000,
            span,
          },
          regular: {
            query: sql`
              SELECT 
                hash,
                quantiles(0.75, 0.90, 0.95, 0.99)(duration) as percentiles
              FROM operations
              ${this.createFilter({ target, period, operations })}
              GROUP BY hash
            `,
            queryId: 'duration_percentiles_regular',
            timeout: 15_000,
            span,
          },
        },
        period,
      ),
    );

    const collection = new Map<string, Percentiles>();

    result.data.forEach(row => {
      collection.set(row.hash, toPercentiles(row.percentiles));
    });

    return collection;
  }

  async getClientNames({
    target,
    period,
  }: {
    target: string;
    period: DateRange;
  }): Promise<string[]> {
    const result = await this.clickHouse.query<{
      client_name: string;
    }>({
      queryId: 'client_names_per_target_v2',
      query: sql`SELECT client_name FROM clients_daily ${this.createFilter({
        target,
        period,
      })} GROUP BY client_name`,
      timeout: 10_000,
    });

    return result.data.map(row => row.client_name);
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
    span?: Span,
  ) {
    // multiply by 1000 to convert to milliseconds
    const result = await this.clickHouse.query<{
      date: number;
      total: number;
      totalOk: number;
      percentiles: [number, number, number, number];
    }>(
      pickQueryByPeriod(
        {
          daily: {
            query: sql`
              SELECT 
                multiply(
                  toUnixTimestamp(
                    toStartOfInterval(timestamp, INTERVAL ${this.clickHouse.translateWindow(
                      calculateTimeWindow({ period, resolution }),
                    )}, 'UTC'),
                  'UTC'),
                1000) as date,
                quantilesMerge(0.75, 0.90, 0.95, 0.99)(duration_quantiles) as percentiles,
                sum(total) as total,
                sum(total_ok) as totalOk
              FROM operations_daily
              ${this.createFilter({ target, period, operations })}
              GROUP BY date
              ORDER BY date
            `,
            queryId: 'duration_and_count_over_time_daily',
            timeout: 15_000,
            span,
          },
          hourly: {
            query: sql`
              SELECT 
                multiply(
                  toUnixTimestamp(
                    toStartOfInterval(timestamp, INTERVAL ${this.clickHouse.translateWindow(
                      calculateTimeWindow({ period, resolution }),
                    )}, 'UTC'),
                  'UTC'),
                1000) as date,
                quantilesMerge(0.75, 0.90, 0.95, 0.99)(duration_quantiles) as percentiles,
                sum(total) as total,
                sum(total_ok) as totalOk
              FROM operations_hourly
              ${this.createFilter({ target, period, operations })}
              GROUP BY date
              ORDER BY date
            `,
            queryId: 'duration_and_count_over_time_hourly',
            timeout: 15_000,
            span,
          },
          regular: {
            query: sql`
              SELECT 
                multiply(
                  toUnixTimestamp(
                    toStartOfInterval(timestamp, INTERVAL ${this.clickHouse.translateWindow(
                      calculateTimeWindow({ period, resolution }),
                    )}, 'UTC'),
                  'UTC'),
                1000) as date,
                quantiles(0.75, 0.90, 0.95, 0.99)(duration) as percentiles,
                count(*) as total,
                sum(ok) as totalOk
              FROM operations
              ${this.createFilter({ target, period, operations })}
              GROUP BY date
              ORDER BY date
            `,
            queryId: 'duration_and_count_over_time_regular',
            timeout: 15_000,
            span,
          },
        },
        period,
        resolution,
      ),
    );

    return result.data.map(row => {
      return {
        date: ensureNumber(row.date) as any,
        total: ensureNumber(row.total),
        totalOk: ensureNumber(row.totalOk),
        duration: toPercentiles(row.percentiles),
      };
    });
  }

  async countOperationsForTargets({ targets }: { targets: readonly string[] }): Promise<number> {
    const result = await this.clickHouse.query<{
      total: string;
    }>({
      // TODO: use the operations_daily table once the FF_CLICKHOUSE_V2_TABLES is available for everyone
      query: sql`SELECT sum(total) as total from operations_hourly WHERE target IN (${sql.array(
        targets,
        'String',
      )})`,
      queryId: 'count_operations_for_targets',
      timeout: 15_000,
    });

    if (result.data.length === 0) {
      return 0;
    }

    if (result.data.length > 1) {
      throw new Error('Too many rows returned, expected 1');
    }

    return ensureNumber(result.data[0].total);
  }

  // Every call to this method is part of the batching logic.
  // The `batch` function works similar to the DataLoader concept.
  // It gathers all function calls within the same event loop,
  // and calls the inner function in the next cycle.
  countCoordinatesOfType = batch(
    async (
      selectors: Array<{
        target: string;
        period: DateRange;
        typename: string;
      }>,
    ) => {
      const aggregationMap = new Map<
        string,
        {
          target: string;
          period: DateRange;
          typenames: string[];
        }
      >();

      const makeKey = (selector: { target: string; period: DateRange }) =>
        `${selector.target}-${selector.period.from}-${selector.period.to}`;

      // Groups the type names by their target and period
      // The idea here is to make the least possible number of queries to ClickHouse
      // by fetching all selected type names of the same target and period.
      for (const selector of selectors) {
        const key = makeKey(selector);
        const value = aggregationMap.get(key);

        if (!value) {
          aggregationMap.set(key, {
            target: selector.target,
            period: selector.period,
            typenames: [selector.typename],
          });
        } else {
          value.typenames.push(selector.typename);
        }
      }

      const resultMap = new Map<
        string,
        Promise<
          {
            coordinate: string;
            total: number;
          }[]
        >
      >();

      // Do the actual call to ClickHouse to get the coordinates and counts of selected type names.
      for (const selector of aggregationMap.values()) {
        const key = makeKey(selector);

        resultMap.set(
          key,
          this.countCoordinatesOfTypes({
            target: selector.target,
            period: selector.period,
            typenames: selector.typenames,
          }),
        );
      }

      // Because the `batch` function is used (it's a similar concept to DataLoader),
      // it has tu return a map of promises matching provided selectors in exact same order.
      return selectors.map(selector => {
        const key = makeKey(selector);
        const value = resultMap.get(key);

        if (!value) {
          throw new Error(`Could not find data for ${key} selector`);
        }

        return value;
      });
    },
  );

  private async countCoordinatesOfTypes({
    target,
    period,
    typenames,
  }: {
    target: string;
    period: DateRange;
    typenames: string[];
  }) {
    const typesConditions = typenames.map(
      t => sql`coordinate = ${t} OR coordinate LIKE ${t + '.%'}`,
    );
    const result = await this.clickHouse.query<{
      coordinate: string;
      total: number;
    }>({
      query: sql`
        SELECT coordinate, sum(total) as total FROM coordinates_daily
        ${this.createFilter({
          target,
          period,
          extra: [sql`(${sql.join(typesConditions, ' OR ')})`],
        })}
        GROUP BY coordinate`,
      queryId: 'coordinates_per_types',
      timeout: 15_000,
    });

    return result.data.map(row => ({
      coordinate: row.coordinate,
      total: ensureNumber(row.total),
    }));
  }

  async countCoordinatesOfTarget({ target, period }: { target: string; period: DateRange }) {
    const result = await this.clickHouse.query<{
      coordinate: string;
      total: number;
    }>({
      query: sql`
        SELECT coordinate, sum(total) as total FROM coordinates_daily
        ${this.createFilter({
          target,
          period,
        })}
        GROUP BY coordinate
      `,
      queryId: 'coordinates_per_target',
      timeout: 15_000,
    });

    return result.data.map(row => ({
      coordinate: row.coordinate,
      total: ensureNumber(row.total),
    }));
  }

  async adminCountOperationsPerTarget({
    period,
  }: {
    period: {
      from: Date;
      to: Date;
    };
  }) {
    const dateRangeFilter = sql.raw(`
      timestamp >= FROM_UNIXTIME(${Math.floor(period.from.getTime() / 1000)})
      AND
      timestamp < FROM_UNIXTIME(${Math.floor(period.to.getTime() / 1000)})
    `);

    const result = await this.clickHouse.query<{
      total: string;
      target: string;
    }>({
      query: sql`SELECT sum(total) as total, target from operations_daily WHERE ${dateRangeFilter} GROUP BY target`,
      queryId: 'admin_operations_per_target',
      timeout: 15_000,
    });

    return result.data.map(row => ({
      total: ensureNumber(row.total),
      target: row.target,
    }));
  }

  async adminOperationsOverTime({
    period,
  }: {
    period: {
      from: Date;
      to: Date;
    };
  }) {
    const days = differenceInDays(period.to, period.from);
    const resolution = 90;
    const dateRangeFilter = sql.raw(`
      timestamp >= FROM_UNIXTIME(${Math.floor(period.from.getTime() / 1000)})
      AND
      timestamp < FROM_UNIXTIME(${Math.floor(period.to.getTime() / 1000)})
    `);
    const result = await this.clickHouse.query<{
      date: number;
      total: string;
    }>({
      query: sql`
        SELECT 
          multiply(
            toUnixTimestamp(
              toStartOfInterval(timestamp, INTERVAL ${this.clickHouse.translateWindow(
                calculateTimeWindow({
                  period,
                  resolution,
                }),
              )}, 'UTC'),
            'UTC'),
          1000) as date,
          sum(total) as total
        FROM ${sql.raw(days > 1 && days >= resolution ? 'operations_daily' : 'operations_hourly')}
        WHERE ${dateRangeFilter}
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
    extra?: SqlValue[];
  }): SqlValue {
    const where: SqlValue[] = [];

    if (target) {
      if (Array.isArray(target)) {
        where.push(sql`target IN (${sql.array(target, 'String')})`);
      } else {
        where.push(sql`target = ${target as string}`);
      }
    }

    if (period) {
      where.push(
        sql`timestamp >= toDateTime(${formatDate(period.from)}, 'UTC')`,
        sql`timestamp <= toDateTime(${formatDate(period.to)}, 'UTC')`,
      );
    }

    if (operations?.length) {
      where.push(sql`(hash) IN (${sql.array(operations, 'String')})`);
    }

    if (extra.length) {
      where.push(...extra);
    }

    const statement = where.length ? sql` PREWHERE ${sql.join(where, ' AND ')} ` : sql``;

    return statement;
  }

  private makeId({
    type,
    field,
    argument,
  }: {
    type: string;
    field?: string | null;
    argument?: string | null;
  }): string {
    return [type, field, argument].filter(Boolean).join('.');
  }
}
