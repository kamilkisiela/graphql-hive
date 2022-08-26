import { Injectable } from 'graphql-modules';
import { format, addMinutes, subDays, isAfter } from 'date-fns';
import type { Span } from '@sentry/types';
import { batch } from '@theguild/buddy';
import { ClickHouse, RowOf } from './clickhouse-client';
import { calculateTimeWindow } from './helpers';
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

const FF_CLICKHOUSE_V2_TABLES = process.env.FF_CLICKHOUSE_V2_TABLES === '1';

if (FF_CLICKHOUSE_V2_TABLES) {
  console.log('Using FF_CLICKHOUSE_V2_TABLES');
}

// Remove after legacy tables are no longer used
function canUseV2(period?: DateRange): boolean {
  if (FF_CLICKHOUSE_V2_TABLES) {
    return true;
  }

  if (!period) {
    return false;
  }

  // 25.08.2022 - data starts to flow into the new tables
  // We can gradually switch to the new tables
  return isAfter(period.from, new Date(2022, 7, 25));
}

function pickQueryByPeriod(
  queryMap: {
    hourly: {
      query: string;
      queryId: string;
      timeout: number;
      span?: Span | undefined;
    };
    daily: {
      query: string;
      queryId: string;
      timeout: number;
      span?: Span | undefined;
    };
    regular: {
      query: string;
      queryId: string;
      timeout: number;
      span?: Span | undefined;
    };
  },
  period: DateRange | null,
  resolution?: number
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

// Remove after legacy tables are no longer used
function canUseHourlyAggTable({ period, resolution }: { period?: DateRange; resolution?: number }): boolean {
  if (period) {
    const distance = period.to.getTime() - period.from.getTime();
    const distanceInHours = distance / 1000 / 60 / 60;

    // We can't show data in 90 time-windows from past 24 hours (based on hourly table)
    if (resolution && distanceInHours < resolution) {
      return false;
    }

    // We can't show data from less past n minutes based on hourly table if the range is less than 1 hours
    if (distanceInHours < 1) {
      return false;
    }
  }

  return true;
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
    span?: Span
  ): Promise<Record<string, number>> {
    const { clientTableName, coordinatesTableName, queryId } = canUseV2(period)
      ? {
          clientTableName: 'clients_daily',
          coordinatesTableName: 'coordinates_daily',
          queryId: 'count_fields_v2',
        }
      : {
          clientTableName: 'client_names_daily',
          coordinatesTableName: 'schema_coordinates_daily',
          queryId: 'count_fields_v2',
        };

    const coordinates = fields.map(selector => this.makeId(selector));
    const conditions = [`( coordinate IN ('${coordinates.join(`', '`)}') )`];

    if (Array.isArray(excludedClients) && excludedClients.length > 0) {
      // Eliminate coordinates fetched by excluded clients.
      // We can connect a coordinate to a client by using the hash column.
      // The hash column is basically a unique identifier of a GraphQL operation.
      conditions.push(`
          hash NOT IN (
            SELECT hash FROM ${clientTableName} ${this.createFilter({
        target,
        period,
        extra: [`client_name IN ('${excludedClients.join(`', '`)}')`],
      })} GROUP BY hash
          )
        `);
    }

    const res = await this.clickHouse.query<{
      total: string;
      coordinate: string;
    }>({
      query: `
            SELECT
              coordinate,
              sum(total) as total
            FROM ${coordinatesTableName}
            ${this.createFilter({
              target,
              period,
              operations,
              extra: conditions,
            })}
            GROUP BY coordinate
          `,
      queryId: queryId,
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
    span?: Span
  ): Promise<{
    total: number;
    ok: number;
    notOk: number;
  }> {
    const query = canUseV2(period)
      ? pickQueryByPeriod(
          {
            daily: {
              query: `SELECT sum(total) as total, sum(total_ok) as totalOk FROM operations_daily ${this.createFilter({
                target,
                period,
                operations,
              })}`,
              queryId: 'count_operations_daily',
              timeout: 10_000,
              span,
            },
            hourly: {
              query: `SELECT sum(total) as total, sum(total_ok) as totalOk FROM operations_hourly ${this.createFilter({
                target,
                period,
                operations,
              })}`,
              queryId: 'count_operations_hourly',
              timeout: 15_000,
              span,
            },
            regular: {
              query: `SELECT count() as total, sum(ok) as totalOk FROM operations ${this.createFilter({
                target,
                period,
                operations,
              })}
  `,
              queryId: 'count_operations_regular',
              timeout: 30_000,
              span,
            },
          },
          period ?? null
        )
      : canUseHourlyAggTable({ period })
      ? {
          query: `SELECT sum(total) as total, sum(total_ok) as totalOk FROM operations_new_hourly_mv ${this.createFilter(
            {
              target,
              period,
              operations,
            }
          )}`,
          queryId: 'count_operations_mv',
          timeout: 15_000,
          span,
        }
      : {
          query: `SELECT count() as total, sum(ok) as totalOk FROM operations_new ${this.createFilter({
            target,
            period,
            operations,
          })}
  `,
          queryId: 'count_operations',
          timeout: 30_000,
          span,
        };

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
    const query = pickQueryByPeriod(
      canUseV2(period)
        ? {
            daily: {
              query: `
                SELECT sum(total) as total, sum(total_ok) as totalOk, hash 
                FROM operations_daily
                ${this.createFilter({
                  target,
                  period,
                  operations,
                })}
                GROUP BY hash
              `,
              queryId: 'count_unique_documents_daily',
              timeout: 10_000,
              span,
            },
            hourly: {
              query: `
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
              queryId: 'count_unique_documents_hourly',
              timeout: 15_000,
              span,
            },
            regular: {
              query: `
                SELECT count() as total, sum(ok) as totalOk, hash
                FROM operations
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
            },
          }
        : {
            daily: {
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
            },
            hourly: {
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
            },
            regular: {
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
            },
          },
      period
    );

    const result = await this.clickHouse.query<{
      total: string;
      totalOk: string;
      hash: string;
    }>(query);
    const total = result.data.reduce((sum, row) => sum + parseInt(row.total, 10), 0);

    const registryResult = await this.clickHouse.query<{
      name?: string;
      body: string;
      hash: string;
      operation_kind: string;
    }>(
      canUseV2(period)
        ? {
            query: `
            SELECT 
              name,
              body,
              hash,
              operation_kind
            FROM operation_collection
              ${this.createFilter({
                target,
                operations,
              })}
            GROUP BY name, body, hash, operation_kind`,
            queryId: 'operations_registry',
            timeout: 15_000,
            span,
          }
        : {
            query: `
            SELECT 
              name,
              body,
              hash,
              operation as operation_kind
            FROM operations_registry FINAL
              ${this.createFilter({
                target,
                operations,
              })}
            GROUP BY name, body, hash, operation`,
            queryId: 'operations_registry',
            timeout: 15_000,
            span,
          }
    );

    const operationsMap = new Map<string, RowOf<typeof registryResult>>();

    for (const row of registryResult.data) {
      operationsMap.set(row.hash, row);
    }

    return result.data.map(row => {
      const rowTotal = parseInt(row.total, 10);
      const rowTotalOk = parseInt(row.totalOk, 10);
      const op = operationsMap.get(row.hash);
      const { name, body, operation_kind } = op ?? {
        name: 'missing',
        body: 'missing',
        operation_kind: 'missing',
      };

      return {
        document: body,
        operationName: `${row.hash.substr(0, 4)}_${name ?? 'anonymous'}`,
        operationHash: row.hash,
        kind: operation_kind,
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
    }>(
      canUseV2(period)
        ? pickQueryByPeriod(
            {
              daily: {
                query: `
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
                queryId: 'count_clients',
                timeout: 10_000,
                span,
              },
              hourly: {
                query: `
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
                queryId: 'count_clients',
                timeout: 10_000,
                span,
              },
              regular: {
                query: `
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
                queryId: 'count_clients',
                timeout: 10_000,
                span,
              },
            },
            period
          )
        : {
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
          }
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
    span?: Span
  ): Promise<
    Array<{
      name: string;
      count: number;
    }>
  > {
    const result = await this.clickHouse.query<{
      count: string;
      client_name: string;
    }>(
      canUseV2(period)
        ? {
            query: `
              SELECT 
                sum(total) as count,
                client_name
              FROM clients_daily
              ${this.createFilter({
                target,
                period,
                operations,
                extra: ['notEmpty(client_name)'],
              })}
              GROUP BY client_name
            `,
            queryId: 'count_client_names',
            timeout: 10_000,
            span,
          }
        : {
            query: `
              SELECT 
                sum(total) as count,
                client_name
              FROM client_names_daily
              ${this.createFilter({
                target,
                period,
                operations,
                extra: ['notEmpty(client_name)'],
              })}
              GROUP BY client_name
            `,
            queryId: 'count_unique_client_names',
            timeout: 15_000,
            span,
          }
    );

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
      canUseV2(period)
        ? pickQueryByPeriod(
            {
              daily: {
                query: `
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
                query: `
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
                query: `
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
            period
          )
        : canUseHourlyAggTable({ period })
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
      canUseV2(period)
        ? pickQueryByPeriod(
            {
              daily: {
                query: `
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
                query: `
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
                query: `
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
            period
          )
        : canUseHourlyAggTable({ period })
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

  async getClientNames({ target, period }: { target: string; period: DateRange }): Promise<string[]> {
    const result = await this.clickHouse.query<{
      client_name: string;
    }>(
      canUseV2(period)
        ? {
            queryId: 'client_names_per_target_v2',
            query: `SELECT client_name FROM clients_daily ${this.createFilter({
              target,
              period,
            })} GROUP BY client_name`,
            timeout: 10_000,
          }
        : {
            queryId: 'client_names_per_target',
            query: `SELECT client_name FROM client_names_daily ${this.createFilter({
              target,
              period,
            })} GROUP BY client_name`,
            timeout: 10_000,
          }
    );

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
    span?: Span
  ) {
    // multiply by 1000 to convert to milliseconds
    const result = await this.clickHouse.query<{
      date: number;
      total: number;
      totalOk: number;
      percentiles: [number, number, number, number];
    }>(
      canUseV2(period)
        ? pickQueryByPeriod(
            {
              daily: {
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
            resolution
          )
        : canUseHourlyAggTable({ period, resolution })
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

  async countOperationsForTargets({ targets }: { targets: readonly string[] }): Promise<number> {
    const result = await this.clickHouse.query<{
      total: string;
    }>({
      // TODO: use the operations_daily table once the FF_CLICKHOUSE_V2_TABLES is available for everyone
      query: `SELECT sum(total) as total from operations_hourly WHERE target IN ('${targets.join(`', '`)}')`,
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
      }>
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
          })
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
    }
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
    const typesFilter = typenames.map(t => `coordinate = '${t}' OR coordinate LIKE '${t}.%'`).join(' OR ');
    const result = await this.clickHouse.query<{
      coordinate: string;
      total: number;
    }>(
      canUseV2(period)
        ? {
            query: `
              SELECT coordinate, sum(total) as total FROM coordinates_daily
              ${this.createFilter({
                target,
                period,
                extra: [`(${typesFilter})`],
              })}
              GROUP BY coordinate`,
            queryId: 'coordinates_per_types',
            timeout: 15_000,
          }
        : {
            query: `
              SELECT coordinate, sum(total) as total FROM schema_coordinates_daily
              ${this.createFilter({
                target,
                period,
                extra: [`(${typesFilter})`],
              })}
              GROUP BY coordinate`,
            queryId: 'coordinates_per_types',
            timeout: 15_000,
          }
    );

    return result.data.map(row => ({
      coordinate: row.coordinate,
      total: ensureNumber(row.total),
    }));
  }

  async countCoordinatesOfTarget({ target, period }: { target: string; period: DateRange }) {
    const result = await this.clickHouse.query<{
      coordinate: string;
      total: number;
    }>(
      canUseV2(period)
        ? {
            query: `
              SELECT coordinate, sum(total) as total FROM coordinates_daily
              ${this.createFilter({
                target,
                period,
              })}
              GROUP BY coordinate
            `,
            queryId: 'coordinates_per_target',
            timeout: 15_000,
          }
        : {
            query: `
              SELECT coordinate, sum(total) as total FROM schema_coordinates_daily
              ${this.createFilter({
                target,
                period,
              })}
              GROUP BY coordinate
            `,
            queryId: 'coordinates_per_target',
            timeout: 15_000,
          }
    );

    return result.data.map(row => ({
      coordinate: row.coordinate,
      total: ensureNumber(row.total),
    }));
  }

  async adminCountOperationsPerTarget({ daysLimit }: { daysLimit: number }) {
    const result = await this.clickHouse.query<{
      total: string;
      target: string;
    }>(
      canUseV2({
        from: subDays(new Date(), daysLimit),
        to: new Date(),
      })
        ? {
            query: `SELECT sum(total) as total, target from operations_daily WHERE timestamp >= subtractDays(NOW(), ${daysLimit}) GROUP BY target`,
            queryId: 'admin_operations_per_target',
            timeout: 15_000,
          }
        : {
            query: `SELECT sum(total) as total, target from operations_new_hourly_mv WHERE timestamp >= subtractDays(NOW(), ${daysLimit}) GROUP BY target`,
            queryId: 'admin_operations_per_target',
            timeout: 15_000,
          }
    );

    return result.data.map(row => ({
      total: ensureNumber(row.total),
      target: row.target,
    }));
  }

  async adminOperationsOverTime({ daysLimit }: { daysLimit: number }) {
    const period = {
      from: subDays(new Date(), daysLimit),
      to: new Date(),
    };
    const resolution = 90;
    const result = await this.clickHouse.query<{
      date: number;
      total: string;
    }>(
      canUseV2(period)
        ? {
            query: `
              SELECT 
                multiply(
                  toUnixTimestamp(
                    toStartOfInterval(timestamp, INTERVAL ${this.clickHouse.translateWindow(
                      calculateTimeWindow({
                        period,
                        resolution,
                      })
                    )}, 'UTC'),
                  'UTC'),
                1000) as date,
                sum(total) as total
              FROM ${daysLimit > 1 && daysLimit >= resolution ? 'operations_daily' : 'operations_hourly'}
              WHERE timestamp >= subtractDays(NOW(), ${daysLimit})
              GROUP BY date
              ORDER BY date
            `,
            queryId: 'admin_operations_per_target',
            timeout: 15_000,
          }
        : {
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
                        resolution,
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
          }
    );

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
