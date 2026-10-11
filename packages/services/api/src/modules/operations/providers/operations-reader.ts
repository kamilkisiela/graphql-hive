import { addMinutes, format } from 'date-fns';
import { Injectable } from 'graphql-modules';
import * as z from 'zod';
import { UTCDate } from '@date-fns/utc';
import { buildOperationsFilterSQLConditions, RawValue, SqlValue } from '@hive/clickhouse';
import { traceFn } from '@hive/service-common';
import type { DateRange } from '../../../shared/entities';
import { batch, batchBy } from '../../../shared/helpers';
import { Logger } from '../../shared/providers/logger';
import { toEndOfInterval, toStartOfInterval } from '../lib/date-time-helpers';
import { pickTableByPeriod } from '../lib/pick-table-by-provider';
import { ClickHouse, RowOf, sql } from './clickhouse-client';
import { calculateTimeWindow } from './helpers';

const CoordinateClientNamesGroupModel = z.array(
  z.object({
    coordinate: z.string(),
    client_names: z.array(z.string()),
  }),
);

export function formatDate(date: Date): string {
  return format(addMinutes(date, date.getTimezoneOffset()), 'yyyy-MM-dd HH:mm:ss');
}

function toUnixTimestamp(utcDate: string): number {
  // 2024-04-26 11:00:00
  const [date, time] = utcDate.split(' ');
  const [year, month, day] = date.split('-');
  const [hour, minute, second] = time.split(':');
  const iso = `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;

  return new UTCDate(iso).getTime();
}

export interface DurationMetrics {
  avg: number;
  p75: number;
  p90: number;
  p95: number;
  p99: number;
}

const ReadOperationModel = z.object({
  target: z.string().uuid(),
  hash: z.string(),
  body: z.string(),
  name: z.string(),
  type: z.union([z.literal('QUERY'), z.literal('MUTATION'), z.literal('SUBSCRIPTION')]),
});

export enum FieldMetricsState {
  /**
   * If the field metric usage data is in sync with other usage data, then the visualization can be shown as intended
   * with all the data and no explanation needed.
   */
  IN_SYNC,

  /**
   * If the field metric usage data and operation metric data did not start at the same time, then this requires an
   * explanation for why the data does not align. Display a warning on the UI.
   */
  HISTORY_MISSING,

  /**
   * If the field metric usage data is not available, because the gateway has never installed the necessary plugin,
   * then we can safely hide this feature on the frontend.
   */
  NO_DATA,
}

type Operation = z.TypeOf<typeof ReadOperationModel>;

function toDurationMetrics(percentiles: [number, number, number, number], avg: number) {
  return {
    avg,
    p75: percentiles[0],
    p90: percentiles[1],
    p95: percentiles[2],
    p99: percentiles[3],
  };
}

function ensureNumber(value: number | string): number {
  if (typeof value === 'number') {
    return value;
  }

  return parseFloat(value);
}

@Injectable({
  global: true,
})
export class OperationsReader {
  constructor(
    private clickHouse: ClickHouse,
    private logger: Logger,
  ) {}

  private pickAggregationByPeriod(args: {
    period: DateRange | null;
    resolution?: number;
    timeout:
      | {
          daily: number;
          hourly: number;
          minutely: number;
        }
      | number;
    query(
      aggregationTableName: (
        tableName:
          | 'operations'
          | 'clients'
          | 'coordinates'
          | 'coordinate_counts'
          | 'coordinate_errors',
      ) => RawValue,
    ): SqlValue;
    queryId(aggregation: 'daily' | 'hourly' | 'minutely'): `${string}_${typeof aggregation}`;
  }) {
    const timeout =
      typeof args.timeout === 'number'
        ? { daily: args.timeout, hourly: args.timeout, minutely: args.timeout }
        : args.timeout;
    let { period, resolution } = args;

    const queryMap = {
      daily: {
        query: args.query(tName => sql.raw(tName + '_daily')),
        queryId: args.queryId('daily'),
        timeout: timeout.daily,
      },
      hourly: {
        query: args.query(tName => sql.raw(tName + '_hourly')),
        queryId: args.queryId('hourly'),
        timeout: timeout.hourly,
      },
      minutely: {
        query: args.query(tName => sql.raw(tName + '_minutely')),
        queryId: args.queryId('minutely'),
        timeout: timeout.minutely,
      },
    };

    if (!period) {
      return {
        ...queryMap.daily,
        queryType: 'daily' as const,
      };
    }

    if (resolution && (resolution < 1 || resolution > 90)) {
      throw new Error('Invalid resolution provided.');
    }

    const now = new UTCDate();
    const interval = resolution ? calculateTimeWindow({ period, resolution }) : null;

    const resolvedTable = pickTableByPeriod({
      now,
      period,
      intervalUnit: interval?.unit,
      logger: this.logger,
    });

    return {
      ...queryMap[resolvedTable],
      queryType: resolvedTable,
    };
  }

  async readMonthlyUsage({ organization }: { organization: string }) {
    const result = await this.clickHouse.query<{
      date: string;
      total: number;
    }>({
      query: sql`
        SELECT
          date,
          sum(total) as total
        FROM monthly_overview
        WHERE organization = ${organization}
        GROUP BY date
        ORDER BY date ASC
        WITH FILL
          FROM toStartOfMonth(now() - INTERVAL 11 MONTHS)
          TO toStartOfMonth(now())
          STEP INTERVAL 1 MONTH
      `,
      queryId: 'read_monthly_usage',
      timeout: 10_000,
    });

    return result.data.map(row => ({
      date: row.date,
      total: ensureNumber(row.total),
    }));
  }

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

  countCoordinateResolutions = batchBy<
    {
      schemaCoordinate: string;
      targetIds: readonly string[];
      period: DateRange;
      operations?: readonly string[];
      excludedClients?: readonly string[] | null;
    },
    Record<string, number>
  >(
    item =>
      `${item.targetIds.join(',')}-${item.excludedClients?.join(',') ?? ''}-${item.operations?.join(',') ?? ''}-${item.period.from.toISOString()}-${item.period.to.toISOString()}`,
    async items => {
      const schemaCoordinates = items.map(item => item.schemaCoordinate);
      return await this.countCoordinateResolution({
        targetIds: items[0].targetIds,
        excludedClients: items[0].excludedClients,
        period: items[0].period,
        operations: items[0].operations,
        schemaCoordinates,
      }).then(result =>
        items.map(item =>
          Promise.resolve({ [item.schemaCoordinate]: result[item.schemaCoordinate] }),
        ),
      );
    },
  );

  /**
   * Count the number of resolutions for a coordinate.
   */
  public async countCoordinateResolution({
    schemaCoordinates,
    targetIds,
    period,
    operations,
    excludedClients,
  }: {
    schemaCoordinates: readonly string[];
    targetIds: string | readonly string[];
    period: DateRange;
    operations?: readonly string[];
    excludedClients?: readonly string[] | null;
  }) {
    const conditions = [sql`(coordinate IN (${sql.array(schemaCoordinates, 'String')}))`];

    if (Array.isArray(excludedClients) && excludedClients.length > 0) {
      // Eliminate coordinates fetched by excluded clients.
      // We can connect a coordinate to a client by using the hash column.
      // The hash column is basically a unique identifier of a GraphQL operation.
      // In the following query we fetch all hashes that were used only by the excluded clients.
      conditions.push(sql`
        hash NOT IN (
          SELECT hash FROM (
            SELECT
              hash,
              countIf(client_name NOT IN (${sql.array(
                excludedClients,
                'String',
              )})) as non_excluded_clients_total
            FROM clients_daily ${this.createFilter({
              target: targetIds,
              period,
            })}
            GROUP BY hash
          ) WHERE non_excluded_clients_total = 0
        )
      `);
    }

    const query = this.pickAggregationByPeriod({
      period,
      query: aggregationTableName => sql`
            SELECT
              coordinate,
              sum(total) as total
            FROM ${aggregationTableName('coordinate_counts')} 
            ${this.createFilter({
              target: targetIds,
              period,
              operations,
              extra: conditions,
            })}
            GROUP BY coordinate
          `,
      queryId: aggregation => `count_fields_v2_${aggregation}`,
      timeout: 30_000,
    });

    const res = await this.clickHouse.query<{
      total: string;
      coordinate: string;
    }>(query);

    const stats: Record<string, number> = {};
    for (const row of res.data) {
      stats[row.coordinate] = ensureNumber(row.total);
    }

    for (const coordinate of schemaCoordinates) {
      if (typeof stats[coordinate] !== 'number') {
        stats[coordinate] = 0;
      }
    }

    return stats;
  }

  countCoordinate = batchBy<
    {
      schemaCoordinate: string;
      targetIds: readonly string[];
      period: DateRange;
      operations?: readonly string[];
      excludedClients?: readonly string[] | null;
    },
    Record<string, number>
  >(
    item =>
      `${item.targetIds.join(',')}-${item.excludedClients?.join(',') ?? ''}-${item.operations?.join(',') ?? ''}-${item.period.from.toISOString()}-${item.period.to.toISOString()}`,
    async items => {
      const schemaCoordinates = items.map(item => item.schemaCoordinate);
      return await this.countCoordinates({
        targetIds: items[0].targetIds,
        excludedClients: items[0].excludedClients,
        period: items[0].period,
        operations: items[0].operations,
        schemaCoordinates,
      }).then(result =>
        items.map(item =>
          Promise.resolve({ [item.schemaCoordinate]: result[item.schemaCoordinate] }),
        ),
      );
    },
  );

  /**
   * Can count the number of requests hitting a coordinate.
   */
  public async countCoordinates({
    schemaCoordinates,
    targetIds,
    period,
    operations,
    excludedClients,
  }: {
    schemaCoordinates: readonly string[];
    targetIds: string | readonly string[];
    period: DateRange;
    operations?: readonly string[];
    excludedClients?: readonly string[] | null;
  }) {
    const conditions = [sql`(coordinate IN (${sql.array(schemaCoordinates, 'String')}))`];

    if (Array.isArray(excludedClients) && excludedClients.length > 0) {
      // Eliminate coordinates fetched by excluded clients.
      // We can connect a coordinate to a client by using the hash column.
      // The hash column is basically a unique identifier of a GraphQL operation.
      // In the following query we fetch all hashes that were used only by the excluded clients.
      conditions.push(sql`
        hash NOT IN (
          SELECT hash FROM (
            SELECT
              hash,
              countIf(client_name NOT IN (${sql.array(
                excludedClients,
                'String',
              )})) as non_excluded_clients_total
            FROM clients_daily ${this.createFilter({
              target: targetIds,
              period,
            })}
            GROUP BY hash
          ) WHERE non_excluded_clients_total = 0
        )
      `);
    }

    const query = this.pickAggregationByPeriod({
      period,
      query: aggregationTableName => sql`
            SELECT
              coordinate,
              sum(total) as total
            FROM ${aggregationTableName('coordinates')} 
            ${this.createFilter({
              target: targetIds,
              period,
              operations,
              extra: conditions,
            })}
            GROUP BY coordinate
          `,
      queryId: aggregation => `count_fields_v2_${aggregation}`,
      timeout: 30_000,
    });

    const res = await this.clickHouse.query<{
      total: string;
      coordinate: string;
    }>(query);

    const stats: Record<string, number> = {};
    for (const row of res.data) {
      stats[row.coordinate] = ensureNumber(row.total);
    }

    for (const coordinate of schemaCoordinates) {
      if (typeof stats[coordinate] !== 'number') {
        stats[coordinate] = 0;
      }
    }

    return stats;
  }

  /** `countCoordinate` split by target, with the distinct operations behind each. */
  countCoordinatePerTarget = batchBy<
    {
      schemaCoordinate: string;
      targetIds: readonly string[];
      period: DateRange;
      excludedClients?: readonly string[] | null;
    },
    Array<{ id: string; count: number; operationCount: number }>
  >(
    item =>
      `${item.targetIds.join(',')}-${item.excludedClients?.join(',') ?? ''}-${item.period.from.toISOString()}-${item.period.to.toISOString()}`,
    async items => {
      const counts = await this.countCoordinatesPerTarget({
        targetIds: items[0].targetIds,
        excludedClients: items[0].excludedClients,
        period: items[0].period,
        schemaCoordinates: items.map(item => item.schemaCoordinate),
      });
      return items.map(item => counts.get(item.schemaCoordinate) ?? []);
    },
  );

  private async countCoordinatesPerTarget(args: {
    schemaCoordinates: readonly string[];
    targetIds: readonly string[];
    period: DateRange;
    excludedClients?: readonly string[] | null;
  }) {
    const conditions = [sql`(coordinate IN (${sql.array(args.schemaCoordinates, 'String')}))`];

    if (Array.isArray(args.excludedClients) && args.excludedClients.length > 0) {
      // Per target, so a target only excluded clients used does not count as used.
      conditions.push(sql`
        (hash, target) NOT IN (
          SELECT hash, target FROM (
            SELECT
              hash,
              target,
              countIf(client_name NOT IN (${sql.array(
                args.excludedClients,
                'String',
              )})) as non_excluded_clients_total
            FROM clients_daily ${this.createFilter({
              target: args.targetIds,
              period: args.period,
            })}
            GROUP BY hash, target
          ) WHERE non_excluded_clients_total = 0
        )
      `);
    }

    const query = this.pickAggregationByPeriod({
      period: args.period,
      query: aggregationTableName => sql`
            SELECT
              coordinate,
              target,
              sum(total) as total,
              uniqExact(hash) as operations
            FROM ${aggregationTableName('coordinates')}
            ${this.createFilter({
              target: args.targetIds,
              period: args.period,
              extra: conditions,
            })}
            GROUP BY coordinate, target
          `,
      queryId: aggregation => `count_coordinates_per_target_${aggregation}`,
      timeout: 30_000,
    });

    const res = await this.clickHouse.query<{
      total: string;
      operations: string;
      coordinate: string;
      target: string;
    }>(query);

    return groupByKey(
      res.data.map(row => ({
        key: row.coordinate,
        id: row.target,
        count: ensureNumber(row.total),
        operationCount: ensureNumber(row.operations),
      })),
    );
  }

  getOperationCountsPerTarget = batchBy<
    {
      hash: string;
      targetIds: readonly string[];
      period: DateRange;
      excludedClients?: readonly string[] | null;
    },
    Array<{ id: string; count: number }>
  >(
    item =>
      `${item.targetIds.join(',')}-${item.excludedClients?.join(',') ?? ''}-${item.period.from.toISOString()}-${item.period.to.toISOString()}`,
    async items => {
      const counts = await this._getOperationCountsPerTarget({
        targetIds: items[0].targetIds,
        excludedClients: items[0].excludedClients ?? null,
        period: items[0].period,
        hashes: Array.from(new Set(items.map(item => item.hash))),
      });
      return items.map(item => counts.get(item.hash) ?? []);
    },
  );

  private async _getOperationCountsPerTarget(args: {
    targetIds: readonly string[];
    excludedClients: null | readonly string[];
    period: DateRange;
    hashes: string[];
  }) {
    const filter = (table: string) => sql`
      PREWHERE
        ${sql.raw(`"${table}"`)}."target" IN (${sql.array(args.targetIds, 'String')})
        AND ${sql.raw(`"${table}"`)}."timestamp" >= toDateTime(${formatDate(args.period.from)}, 'UTC')
        AND ${sql.raw(`"${table}"`)}."timestamp" <= toDateTime(${formatDate(args.period.to)}, 'UTC')
        AND ${sql.raw(`"${table}"`)}."hash" IN (${sql.longArray(args.hashes, 'String')})
        ${args.excludedClients ? sql`AND ${sql.raw(`"${table}"`)}."client_name" NOT IN (${sql.array(args.excludedClients, 'String')})` : sql``}
    `;

    const rows = await this.clickHouse
      .postQuery({
        queryId: '_getOperationCountsPerTarget',
        query: sql`
          SELECT "hash", "target", SUM("total") AS "count"
          FROM (
            SELECT "operations_daily"."hash" AS "hash", "operations_daily"."target" AS "target", "operations_daily"."total" AS "total"
            FROM "operations_daily"
            ${filter('operations_daily')}

            UNION ALL

            SELECT "subscription_operations_daily"."hash" AS "hash", "subscription_operations_daily"."target" AS "target", "subscription_operations_daily"."total" AS "total"
            FROM "subscription_operations_daily"
            ${filter('subscription_operations_daily')}
          )
          GROUP BY "hash", "target"
        `,
        timeout: 10_000,
      })
      .then(result =>
        z
          .array(
            z.object({
              hash: z.string(),
              target: z.string(),
              count: z.string().transform(ensureNumber),
            }),
          )
          .parse(result.data),
      );

    return groupByKey(rows.map(row => ({ key: row.hash, id: row.target, count: row.count })));
  }

  countCoordinateFailure = batchBy<
    {
      schemaCoordinate: string;
      targetIds: readonly string[];
      period: DateRange;
      operations?: readonly string[];
      excludedClients?: readonly string[] | null;
    },
    Record<string, number>
  >(
    item =>
      `${item.targetIds.join(',')}-${item.excludedClients?.join(',') ?? ''}-${item.operations?.join(',') ?? ''}-${item.period.from.toISOString()}-${item.period.to.toISOString()}`,
    async items => {
      const schemaCoordinates = items.map(item => item.schemaCoordinate);
      return await this.countCoordinateFailures({
        targetIds: items[0].targetIds,
        excludedClients: items[0].excludedClients,
        period: items[0].period,
        operations: items[0].operations,
        schemaCoordinates,
      }).then(result =>
        items.map(item =>
          Promise.resolve({ [item.schemaCoordinate]: result[item.schemaCoordinate] }),
        ),
      );
    },
  );

  public async countCoordinateFailures({
    schemaCoordinates,
    targetIds,
    period,
    operations,
    excludedClients,
  }: {
    schemaCoordinates: readonly string[];
    targetIds: string | readonly string[];
    period: DateRange;
    operations?: readonly string[];
    excludedClients?: readonly string[] | null;
  }) {
    const conditions = [sql`(coordinate IN (${sql.array(schemaCoordinates, 'String')}))`];

    if (Array.isArray(excludedClients) && excludedClients.length > 0) {
      // Eliminate coordinates fetched by excluded clients.
      // We can connect a coordinate to a client by using the hash column.
      // The hash column is basically a unique identifier of a GraphQL operation.
      // In the following query we fetch all hashes that were used only by the excluded clients.
      conditions.push(sql`
        hash NOT IN (
          SELECT hash FROM (
            SELECT
              hash,
              countIf(client_name NOT IN (${sql.array(
                excludedClients,
                'String',
              )})) as non_excluded_clients_total
            FROM clients_daily ${this.createFilter({
              target: targetIds,
              period,
            })}
            GROUP BY hash
          ) WHERE non_excluded_clients_total = 0
        )
      `);
    }

    const query = this.pickAggregationByPeriod({
      period,
      query: aggregationTableName => sql`
        SELECT
          coordinate,
          sum(total_errors) as total
        FROM ${aggregationTableName('coordinate_errors')}
        ${this.createFilter({
          target: targetIds,
          period,
          operations,
          extra: conditions,
        })}
        GROUP BY coordinate
      `,
      queryId: aggregation => `count_failure_fields_v1_${aggregation}`,
      timeout: 30_000,
    });

    const res = await this.clickHouse.query<{
      total: string;
      coordinate: string;
    }>(query);

    const stats: Record<string, number> = {};
    for (const row of res.data) {
      stats[row.coordinate] = ensureNumber(row.total);
    }

    for (const coordinate of schemaCoordinates) {
      if (typeof stats[coordinate] !== 'number') {
        stats[coordinate] = 0;
      }
    }

    return stats;
  }

  private async countFields({
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
    excludedClients?: readonly string[] | null;
  }): Promise<Record<string, number>> {
    const schemaCoordinates = fields.map(selector => this.makeId(selector));
    return this.countCoordinates({
      schemaCoordinates,
      targetIds: target,
      period,
      operations,
      excludedClients,
    });
  }

  async hasCollectedOperations({
    target,
  }: {
    target: string | readonly string[];
  }): Promise<boolean> {
    const result = await this.clickHouse.query<{
      exists: number;
    }>({
      query: sql`
        SELECT
          1 AS "exists"
        FROM
          "target_existence"
        ${this.createFilter({
          target,
        })}
        GROUP BY "target"
        LIMIT 1

        UNION DISTINCT

        SELECT
          1 AS "exists"
        FROM
          "subscription_target_existence"
        ${this.createFilter({
          target,
        })}
        GROUP BY "target"
        LIMIT 1
      `,
      queryId: 'has_collected_operations',
      timeout: 10_000,
    });

    return result.rows > 0;
  }

  async getHasCollectedSubscriptionOperations(args: { target: string }) {
    const result = await this.clickHouse.query<{
      exists: number;
    }>({
      query: sql`
        SELECT
          1 AS "exists"
        FROM
          "subscription_target_existence"
        ${this.createFilter({
          target: args.target,
        })}
        GROUP BY "target"
        LIMIT 1
      `,
      queryId: 'has_collected_subscription_operations',
      timeout: 10_000,
    });

    return result.rows > 0;
  }

  async countOperationsWithoutDetails({
    target,
    period,
  }: {
    target: string | readonly string[];
    period: DateRange;
  }): Promise<number> {
    const query = this.pickAggregationByPeriod({
      period,
      timeout: {
        daily: 30_000,
        hourly: 15_000,
        minutely: 10_000,
      },
      query: aggregationTableName =>
        sql`SELECT sum(total) as total FROM ${aggregationTableName('operations')} ${this.createFilter(
          {
            target,
            period,
          },
        )}`,
      queryId: aggregation => `count_operations_${aggregation}`,
    });

    const result = await this.clickHouse.query<{
      total: number;
    }>(query);

    const total = ensureNumber(result.data[0].total);

    return total;
  }

  /** Read the statistics of fields for a given list of targets in a period. */
  async readFieldListStats(args: {
    targetIds: readonly string[];
    period: DateRange;
    excludedClients: readonly string[] | null;
    fields: readonly {
      type: string;
      field?: string | null;
      argument?: string | null;
    }[];
  }) {
    const [totalFields, total] = await Promise.all([
      this.countFields({
        fields: args.fields,
        target: args.targetIds,
        period: args.period,
        excludedClients: args.excludedClients,
      }),
      this.countOperationsWithoutDetails({ target: args.targetIds, period: args.period }),
    ]);

    return Object.keys(totalFields).map(id => {
      const [type, field, argument] = id.split('.');
      const totalField = totalFields[id] ?? 0;

      return {
        type,
        field,
        argument,
        period: args.period,
        count: totalField,
        percentage: total === 0 ? 0 : (totalField / total) * 100,
      };
    });
  }

  async countRequests({
    target,
    period,
    operations,
    clients,
    clientVersionFilters,
    excludeOperations,
    excludeClientVersionFilters,
    schemaCoordinate,
  }: {
    target: string | readonly string[];
    period: DateRange;
    operations?: readonly string[];
    clients?: readonly string[];
    clientVersionFilters?: readonly { clientName: string; versions: readonly string[] | null }[];
    excludeOperations?: boolean;
    excludeClientVersionFilters?: boolean;
    schemaCoordinate?: string;
  }): Promise<{
    total: number;
    ok: number;
    notOk: number;
  }> {
    const query = this.pickAggregationByPeriod({
      timeout: {
        minutely: 10_000,
        hourly: 15_000,
        daily: 30_000,
      },
      queryId: aggregation => `count_operations_${aggregation}`,
      query: aggregationTableName =>
        sql`SELECT sum(total) as total, sum(total_ok) as totalOk FROM ${aggregationTableName('operations')} ${this.createFilter(
          {
            target,
            period,
            operations,
            clients,
            clientVersionFilters,
            excludeOperations,
            excludeClientVersionFilters,
            extra: schemaCoordinate
              ? [
                  sql`hash IN (SELECT hash FROM ${aggregationTableName('coordinates')} ${this.createFilter(
                    {
                      target,
                      period,
                      extra: [sql`coordinate = ${schemaCoordinate}`],
                    },
                  )})`,
                ]
              : [],
          },
        )}`,
      period,
    });

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

  async countFailures({
    target,
    period,
    operations,
    clients,
    clientVersionFilters,
    excludeOperations,
    excludeClientVersionFilters,
  }: {
    target: string;
    period: DateRange;
    operations?: readonly string[];
    clients?: readonly string[];
    clientVersionFilters?: readonly { clientName: string; versions: readonly string[] | null }[];
    excludeOperations?: boolean;
    excludeClientVersionFilters?: boolean;
  }): Promise<number> {
    return this.countRequests({
      target,
      period,
      operations,
      clients,
      clientVersionFilters,
      excludeOperations,
      excludeClientVersionFilters,
    }).then(r => r.notOk);
  }

  async countUniqueDocuments({
    target,
    period,
    operations,
    clients,
    clientVersionFilters,
    excludeOperations,
    excludeClientVersionFilters,
  }: {
    target: string;
    period: DateRange;
    operations?: readonly string[];
    clients?: readonly string[];
    clientVersionFilters?: readonly { clientName: string; versions: readonly string[] | null }[];
    excludeOperations?: boolean;
    excludeClientVersionFilters?: boolean;
  }): Promise<number> {
    const query = this.pickAggregationByPeriod({
      period,
      timeout: {
        daily: 30_000,
        hourly: 15_000,
        minutely: 10_000,
      },
      query: aggregationTableName =>
        sql`SELECT count(distinct hash) as total FROM ${aggregationTableName('operations')} ${this.createFilter(
          {
            target,
            period,
            operations,
            clients,
            clientVersionFilters,
            excludeOperations,
            excludeClientVersionFilters,
          },
        )}`,
      queryId: aggregation => `count_unique_documents_${aggregation}`,
    });

    const result = await this.clickHouse.query<{
      total: string;
    }>(query);

    return result.data.length ? parseInt(result.data[0].total, 10) : 0;
  }

  async readUniqueDocuments({
    target,
    period,
    operations,
    clients,
    clientVersionFilters,
    excludeOperations,
    excludeClientVersionFilters,
    schemaCoordinate,
  }: {
    target: string;
    period: DateRange;
    operations?: readonly string[];
    clients?: readonly string[];
    clientVersionFilters?: readonly { clientName: string; versions: readonly string[] | null }[];
    excludeOperations?: boolean;
    excludeClientVersionFilters?: boolean;
    schemaCoordinate?: string;
  }): Promise<
    Array<{
      operationHash: string;
      operationName: string;
      kind: string;
      count: number;
      countOk: number;
      percentage: number;
    }>
  > {
    const query = this.pickAggregationByPeriod({
      period,
      timeout: {
        daily: 30_000,
        hourly: 15_000,
        minutely: 10_000,
      },
      query: aggregationTableName =>
        sql`SELECT sum(total) as total, sum(total_ok) as totalOk, hash FROM ${aggregationTableName(
          'operations',
        )} ${this.createFilter({
          target,
          period,
          operations,
          clients,
          clientVersionFilters,
          excludeOperations,
          excludeClientVersionFilters,
          extra: schemaCoordinate
            ? [
                sql`hash IN (SELECT hash FROM ${aggregationTableName('coordinates')} ${this.createFilter(
                  {
                    target,
                    period,
                    extra: [sql`coordinate = ${schemaCoordinate}`],
                  },
                )})`,
              ]
            : [],
        })} GROUP BY hash`,
      queryId: aggregation => `read_unique_documents_${aggregation}`,
    });

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
          FROM operation_collection_details
            ${this.createFilter({
              target,
              extra: [
                sql`
                  hash IN (
                    SELECT hash
                    FROM ${sql.raw('operations_' + query.queryType)}
                    ${this.createFilter({
                      target,
                      period,
                      operations,
                      clientVersionFilters,
                      excludeOperations,
                      excludeClientVersionFilters,
                      extra: schemaCoordinate
                        ? [
                            sql`hash IN (SELECT hash FROM ${sql.raw('coordinates_' + query.queryType)} ${this.createFilter(
                              {
                                target,
                                period,
                                extra: [sql`coordinate = ${schemaCoordinate}`],
                              },
                            )})`,
                          ]
                        : [],
                    })}
                    GROUP BY hash
                  )
                `,
              ],
            })}
          GROUP BY name, hash, operation_kind
        `,
        queryId: 'operations_registry_' + query.queryType,
        timeout: 15_000,
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

  readOperation = batch<{ targetIds: Array<string>; hash: string }, Operation | null>(
    async args => {
      const allTargetIds = Array.from(new Set(args.flatMap(arg => arg.targetIds)));
      const hashes = Array.from(new Set(args.map(arg => arg.hash)));

      const result = await this.clickHouse.query<unknown>({
        query: sql`
        SELECT
          "operation_collection_details"."target" AS "target",
          "operation_collection_details"."hash" AS "hash",
          upper("operation_collection_details"."operation_kind") AS "type",
          "operation_collection_details"."name" AS "name",
          "body_join"."body" AS "body"
        FROM "operation_collection_details"
        RIGHT JOIN (
          SELECT
            "operation_collection_body"."target" AS "target",
            "operation_collection_body"."hash" AS "hash",
            "operation_collection_body"."body" AS "body"
          FROM "operation_collection_body"
            ${this.createFilter({
              target: allTargetIds,
              extra: [sql`"operation_collection_body"."hash" IN (${sql.array(hashes, 'String')})`],
              namespace: 'operation_collection_body',
            })}
          LIMIT 1
            BY
              "operation_collection_body"."target",
              "operation_collection_body"."hash"
        ) AS "body_join"
          ON "operation_collection_details"."hash" = "body_join"."hash"
          ${this.createFilter({
            target: allTargetIds,
            extra: [sql`"operation_collection_details"."hash" IN (${sql.array(hashes, 'String')})`],
            namespace: 'operation_collection_details',
          })}
        LIMIT 1
          BY
            "operation_collection_details"."target" AS "target",
            "operation_collection_details"."hash"
        SETTINGS allow_asynchronous_read_from_io_pool_for_merge_tree = 1
      `,
        queryId: 'read_body',
        timeout: 10_000,
      });

      const lookupMap = new Map<string, Operation>(
        result.data.map(row => {
          const record = ReadOperationModel.parse(row);
          return [`${record.target}/${record.hash}`, record];
        }),
      );

      return args.map(async arg => {
        for (const targetId of arg.targetIds) {
          const operation = lookupMap.get(`${targetId}/${arg.hash}`);
          if (operation) {
            return operation;
          }
        }
        return null;
      });
    },
  );

  async getReportedSchemaCoordinates({
    target,
    period,
  }: {
    target: string;
    period: DateRange;
  }): Promise<Set<string>> {
    const result = await this.clickHouse.query<{
      coordinate: string;
    }>(
      this.pickAggregationByPeriod({
        query: aggregationTableName => sql`
          SELECT
            coordinate
          FROM ${aggregationTableName('coordinates')}
            ${this.createFilter({
              target,
              period,
            })}
          WHERE coordinate NOT ILIKE '%.__typename'
          GROUP BY coordinate
        `,
        queryId: aggregation => `reported_schema_coordinates_${aggregation}`,
        timeout: 10_000,
        period,
      }),
    );

    return new Set(result.data.map(row => row.coordinate));
  }

  async countUniqueClients({
    target,
    period,
    operations,
    clients,
    clientVersionFilters,
    excludeOperations,
    excludeClientVersionFilters,
    schemaCoordinate,
  }: {
    target: string;
    period: DateRange;
    operations?: readonly string[];
    clients?: readonly string[];
    clientVersionFilters?: readonly { clientName: string; versions: readonly string[] | null }[];
    excludeOperations?: boolean;
    excludeClientVersionFilters?: boolean;
    schemaCoordinate?: string;
  }): Promise<
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
      this.pickAggregationByPeriod({
        query: aggregationTableName => sql`
              SELECT
                sum(total) as total,
                client_name,
                client_version
              FROM ${aggregationTableName('clients')}
              ${this.createFilter({
                target,
                period,
                operations,
                clients,
                clientVersionFilters,
                excludeOperations,
                excludeClientVersionFilters,
                extra: schemaCoordinate
                  ? [
                      sql`hash IN (SELECT hash FROM ${aggregationTableName('coordinates')} ${this.createFilter(
                        {
                          target,
                          period,
                          extra: [sql`coordinate = ${schemaCoordinate}`],
                        },
                      )})`,
                    ]
                  : [],
              })}
              GROUP BY client_name, client_version
              ORDER BY total DESC
            `,
        queryId: aggregation => `count_clients_${aggregation}`,
        timeout: 10_000,
        period,
      }),
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

  async readClientVersions({
    target,
    period,
    clientName,
    limit,
  }: {
    target: string;
    period: DateRange;
    clientName: string;
    limit: number;
  }): Promise<{ version: string; count: number; percentage: number }[]> {
    const result = await this.clickHouse.query<{
      total: string;
      client_version: string;
    }>(
      this.pickAggregationByPeriod({
        query: aggregationTableName => sql`
              SELECT
                sum(total) as total,
                client_version
              FROM ${aggregationTableName('clients')}
              ${this.createFilter({
                target,
                period,
                clients: clientName === 'unknown' ? [clientName, ''] : [clientName],
              })}
              GROUP BY client_version
              ORDER BY total DESC
              LIMIT ${sql.raw(limit.toString())}
            `,
        queryId: aggregation => `read_client_versions_${aggregation}`,
        timeout: 10_000,
        period,
      }),
    );

    const total = result.data.reduce((sum, row) => sum + parseInt(row.total, 10), 0);

    return result.data.map(row => {
      const versionTotal = ensureNumber(row.total);
      return {
        version: row.client_version || 'unknown',
        count: versionTotal,
        percentage: (versionTotal / total) * 100,
      };
    });
  }

  /** Get the total amount of requests for a list of targets for a period. */
  async getTotalAmountOfRequests(args: {
    targetIds: readonly string[];
    excludedClients: null | readonly string[];
    period: DateRange;
  }) {
    const TotalCountModel = z
      .tuple([z.object({ amountOfRequests: z.string() })])
      .transform(data => ensureNumber(data[0].amountOfRequests));

    return await this.clickHouse
      .query<unknown>({
        queryId: 'getTotalCountForSchemaCoordinates',
        query: sql`
          SELECT
            SUM("result"."total") AS "amountOfRequests"
          FROM (
            SELECT
              SUM("operations_daily"."total") AS "total"
            FROM
              "operations_daily"
            PREWHERE
              "operations_daily"."target" IN (${sql.array(args.targetIds, 'String')})
              AND "operations_daily"."timestamp" >= toDateTime(${formatDate(args.period.from)}, 'UTC')
              AND "operations_daily"."timestamp" <= toDateTime(${formatDate(args.period.to)}, 'UTC')
              ${args.excludedClients ? sql`AND "operations_daily"."client_name" NOT IN (${sql.array(args.excludedClients, 'String')})` : sql``}

            UNION ALL

            SELECT
              SUM("subscription_operations_daily"."total") AS "total"
            FROM
              "subscription_operations_daily"
            PREWHERE
              "subscription_operations_daily"."target" IN (${sql.array(args.targetIds, 'String')})
              AND "subscription_operations_daily"."timestamp" >= toDateTime(${formatDate(args.period.from)}, 'UTC')
              AND "subscription_operations_daily"."timestamp" <= toDateTime(${formatDate(args.period.to)}, 'UTC')
              ${args.excludedClients ? sql`AND "subscription_operations_daily"."client_name" NOT IN (${sql.array(args.excludedClients, 'String')})` : sql``}
          ) AS "result"
          `,
        timeout: 10_000,
      })
      .then(result => TotalCountModel.parse(result.data));
  }

  /** Result array retains the order of the input `args.schemaCoordinates`. */
  private async _getTopOperationsForSchemaCoordinates(args: {
    targetIds: readonly string[];
    excludedClients: null | readonly string[];
    period: DateRange;
    schemaCoordinates: string[];
  }) {
    const RecordArrayType = z.array(
      z.object({
        coordinate: z.string(),
        hash: z.string(),
        name: z.string(),
        count: z.string().transform(ensureNumber),
      }),
    );

    this.logger.debug('Fetching top operations for schema coordinates (args=%o)', args);

    /**
     * top_operations_by_coordinates -> get the top operations for schema coordinates, we need to right join operations_daily as coordinates_daily does not contain the client_names column
     */
    const results = await this.clickHouse
      .postQuery({
        queryId: '_getTopOperationsForSchemaCoordinates',
        query: sql`
          WITH "top_operations_by_coordinates" AS (
            SELECT DISTINCT
              "coordinates_daily"."coordinate" AS "coordinate",
              "coordinates_daily"."hash" AS "hash",
              "operations_join"."total" AS "total"
            FROM
              "coordinates_daily"
            RIGHT JOIN (
              SELECT
                "operations_daily"."hash",
                SUM("operations_daily"."total") AS "total"
              FROM
                "operations_daily"
              PREWHERE
                "target" IN (${sql.array(args.targetIds, 'String')})
                AND "timestamp" >= toDateTime(${formatDate(args.period.from)}, 'UTC')
                AND "timestamp" <= toDateTime(${formatDate(args.period.to)}, 'UTC')
                ${args.excludedClients ? sql`AND "client_name" NOT IN (${sql.array(args.excludedClients, 'String')})` : sql``}
              GROUP BY
                "hash"

              UNION ALL

              SELECT
                "subscription_operations_daily"."hash",
                SUM("subscription_operations_daily"."total") AS "total"
              FROM
                "subscription_operations_daily"
              PREWHERE
                "target" IN (${sql.array(args.targetIds, 'String')})
                AND "timestamp" >= toDateTime(${formatDate(args.period.from)}, 'UTC')
                AND "timestamp" <= toDateTime(${formatDate(args.period.to)}, 'UTC')
                ${args.excludedClients ? sql`AND "client_name" NOT IN (${sql.array(args.excludedClients, 'String')})` : sql``}
              GROUP BY
                "hash"
            ) AS "operations_join" ON "coordinates_daily"."hash" = "operations_join"."hash"
            PREWHERE
              "coordinates_daily"."target" IN (${sql.array(args.targetIds, 'String')})
              AND "coordinates_daily"."timestamp" >= toDateTime(${formatDate(args.period.from)}, 'UTC')
              AND "coordinates_daily"."timestamp" <= toDateTime(${formatDate(args.period.to)}, 'UTC')
              AND "coordinates_daily"."coordinate" IN (${sql.longArray(args.schemaCoordinates, 'String')})
            ORDER BY
              "total" DESC,
              "coordinates_daily"."hash" DESC
            LIMIT 10
              BY "coordinates_daily"."coordinate"
          )
          SELECT
            "top_operations_by_coordinates"."coordinate" AS "coordinate",
            "top_operations_by_coordinates"."hash" AS "hash",
            "operation_names"."name" AS "name",
            "top_operations_by_coordinates"."total" AS "count"
          FROM
            "top_operations_by_coordinates"
          LEFT JOIN (
            SELECT
              "operation_collection_details"."name",
              "operation_collection_details"."hash"
            FROM
              "operation_collection_details"
            PREWHERE
              "operation_collection_details"."target" IN (${sql.array(args.targetIds, 'String')})
              AND "operation_collection_details"."hash" IN (SELECT DISTINCT "hash" FROM "top_operations_by_coordinates")
            LIMIT 1
            BY "operation_collection_details"."hash"
          ) AS "operation_names"
            ON "operation_names"."hash" = "top_operations_by_coordinates"."hash"
          ORDER BY
            "top_operations_by_coordinates"."coordinate" DESC,
            "top_operations_by_coordinates"."total" DESC
          `,
        timeout: 10_000,
      })
      .then(result => RecordArrayType.parse(result.data));

    const operationsBySchemaCoordinate = new Map<
      string,
      Array<{
        hash: string;
        name: string;
        count: number;
      }>
    >();

    for (const result of results) {
      let records = operationsBySchemaCoordinate.get(result.coordinate);
      if (!records) {
        records = [];
        operationsBySchemaCoordinate.set(result.coordinate, records);
      }
      records.push({
        hash: result.hash,
        name: result.name,
        count: result.count,
      });
    }

    return args.schemaCoordinates.map(
      schemaCoordinate => operationsBySchemaCoordinate.get(schemaCoordinate) ?? null,
    );
  }

  /** Get the top operations for a given schema coordinate (uses batch loader underneath). */
  getTopOperationsForSchemaCoordinate = batchBy<
    {
      targetIds: readonly string[];
      excludedClients: null | readonly string[];
      period: DateRange;
      schemaCoordinate: string;
    },
    Array<{
      hash: string;
      name: string;
      count: number;
    }> | null
  >(
    item =>
      `${item.targetIds.join(',')}-${item.excludedClients?.join(',') ?? ''}-${item.period.from.toISOString()}-${item.period.to.toISOString()}`,
    async items => {
      const schemaCoordinates = items.map(item => item.schemaCoordinate);
      return await this._getTopOperationsForSchemaCoordinates({
        targetIds: items[0].targetIds,
        excludedClients: items[0].excludedClients,
        period: items[0].period,
        schemaCoordinates,
      }).then(result => result.map(result => Promise.resolve(result)));
    },
  );

  /** Result array retains the order of the input `args.schemaCoordinates`. */
  private async _getTopClientsForSchemaCoordinates(args: {
    targetIds: readonly string[];
    excludedClients: null | readonly string[];
    period: DateRange;
    schemaCoordinates: string[];
  }) {
    const RecordArrayType = z.array(
      z.object({
        coordinate: z.string(),
        name: z.string(),
        count: z.string().transform(ensureNumber),
      }),
    );

    this.logger.debug('Fetching top clients for schema coordinates (args=%o)', args);

    const results = await this.clickHouse
      .postQuery({
        queryId: '_getTopClientsForSchemaCoordinates',
        query: sql`
          WITH "coordinates_to_client_name_mapping" AS (
           SELECT
              "coordinates_daily"."coordinate" AS "coordinate",
              "operations_daily_filtered"."client_name" AS "client_name"
            FROM
              "coordinates_daily"
            LEFT JOIN (
              SELECT
                "operations_daily"."hash",
                "operations_daily"."client_name"
              FROM
                "operations_daily"
              PREWHERE
                "operations_daily"."target" IN (${sql.array(args.targetIds, 'String')})
                AND "operations_daily"."timestamp" >= toDateTime(${formatDate(args.period.from)}, 'UTC')
                AND "operations_daily"."timestamp" <= toDateTime(${formatDate(args.period.to)}, 'UTC')
                ${args.excludedClients ? sql`AND "operations_daily"."client_name" NOT IN (${sql.array(args.excludedClients, 'String')})` : sql``}
              LIMIT 1
                BY
                  "operations_daily"."hash",
                  "operations_daily"."client_name"

              UNION ALL

              SELECT
                "subscription_operations_daily"."hash",
                "subscription_operations_daily"."client_name"
              FROM
                "subscription_operations_daily"
              PREWHERE
                "subscription_operations_daily"."target" IN (${sql.array(args.targetIds, 'String')})
                AND "subscription_operations_daily"."timestamp" >= toDateTime(${formatDate(args.period.from)}, 'UTC')
                AND "subscription_operations_daily"."timestamp" <= toDateTime(${formatDate(args.period.to)}, 'UTC')
                ${args.excludedClients ? sql`AND "subscription_operations_daily"."client_name" NOT IN (${sql.array(args.excludedClients, 'String')})` : sql``}
              LIMIT 1
                BY
                  "subscription_operations_daily"."hash",
                  "subscription_operations_daily"."client_name"
            ) AS "operations_daily_filtered"
               ON "operations_daily_filtered"."hash" = "coordinates_daily"."hash"
            PREWHERE
              "coordinates_daily"."target" IN (${sql.array(args.targetIds, 'String')})
              AND "coordinates_daily"."timestamp" >= toDateTime(${formatDate(args.period.from)}, 'UTC')
              AND "coordinates_daily"."timestamp" <= toDateTime(${formatDate(args.period.to)}, 'UTC')
              AND "coordinates_daily"."coordinate" IN (${sql.longArray(args.schemaCoordinates, 'String')})
            LIMIT 1
            BY
              "coordinates_daily"."coordinate",
              "operations_daily_filtered"."client_name"
          )

        SELECT
          "result"."coordinate" AS "coordinate",
          "result"."name" AS "name",
          SUM("result"."count") AS "count"
        FROM (
          SELECT
            "coordinates_to_client_name_mapping"."coordinate" AS "coordinate",
            "clients_daily"."client_name" AS "name",
            "clients_daily"."total" AS "count"
          FROM
            "clients_daily"
          LEFT JOIN
            "coordinates_to_client_name_mapping"
            ON "clients_daily"."client_name" = "coordinates_to_client_name_mapping"."client_name"
          PREWHERE
            "clients_daily"."target" IN (${sql.array(args.targetIds, 'String')})
            AND "clients_daily"."timestamp" >= toDateTime(${formatDate(args.period.from)}, 'UTC')
            AND "clients_daily"."timestamp" <= toDateTime(${formatDate(args.period.to)}, 'UTC')
            ${args.excludedClients ? sql`AND "clients_daily"."client_name" NOT IN (${sql.array(args.excludedClients, 'String')})` : sql``}

          UNION ALL

          SELECT
            "coordinates_to_client_name_mapping"."coordinate" AS "coordinate",
            "subscription_operations_daily"."client_name" AS "name",
            "subscription_operations_daily"."total" AS "count"
          FROM
            "subscription_operations_daily"
          LEFT JOIN
            "coordinates_to_client_name_mapping"
            ON "subscription_operations_daily"."client_name" = "coordinates_to_client_name_mapping"."client_name"
          PREWHERE
            "subscription_operations_daily"."target" IN (${sql.array(args.targetIds, 'String')})
            AND "subscription_operations_daily"."timestamp" >= toDateTime(${formatDate(args.period.from)}, 'UTC')
            AND "subscription_operations_daily"."timestamp" <= toDateTime(${formatDate(args.period.to)}, 'UTC')
            ${args.excludedClients ? sql`AND "subscription_operations_daily"."client_name" NOT IN (${sql.array(args.excludedClients, 'String')})` : sql``}
        ) AS "result"
        GROUP BY
          "result"."coordinate",
          "result"."name"
        ORDER BY
          SUM("result"."count") DESC
        LIMIT 10
        BY
          "result"."coordinate",
          "result"."name"
        `,
        timeout: 10_000,
      })
      .then(result => RecordArrayType.parse(result.data));

    const operationsBySchemaCoordinate = new Map<
      string,
      Array<{
        name: string;
        count: number;
      }>
    >();

    for (const result of results) {
      let records = operationsBySchemaCoordinate.get(result.coordinate);
      if (!records) {
        records = [];
        operationsBySchemaCoordinate.set(result.coordinate, records);
      }
      records.push({
        name: result.name === '' ? 'unknown' : result.name,
        count: result.count,
      });
    }

    return args.schemaCoordinates.map(
      schemaCoordinate => operationsBySchemaCoordinate.get(schemaCoordinate) ?? null,
    );
  }

  getTopClientsForSchemaCoordinate = batchBy<
    {
      targetIds: readonly string[];
      excludedClients: null | readonly string[];
      period: DateRange;
      schemaCoordinate: string;
    },
    Array<{ name: string; count: number }> | null
  >(
    item =>
      `${item.targetIds.join(',')}-${item.excludedClients?.join(',') ?? ''}-${item.period.from.toISOString()}-${item.period.to.toISOString()}`,
    async items => {
      const schemaCoordinates = items.map(item => item.schemaCoordinate);
      return await this._getTopClientsForSchemaCoordinates({
        targetIds: items[0].targetIds,
        excludedClients: items[0].excludedClients,
        period: items[0].period,
        schemaCoordinates,
      }).then(result => result.map(result => Promise.resolve(result)));
    },
  );

  async countClientVersions({
    target,
    period,
    clientName,
  }: {
    target: string;
    period: DateRange;
    clientName: string;
  }): Promise<number> {
    const result = await this.clickHouse.query<{
      total: string;
    }>(
      this.pickAggregationByPeriod({
        query: aggregationTableName => sql`
              SELECT
                count(distinct client_version) as total
              FROM ${aggregationTableName('clients')}
              ${this.createFilter({
                target,
                period,
                clients: clientName === 'unknown' ? [clientName, ''] : [clientName],
              })}
            `,
        queryId: aggregation => `count_client_versions_${aggregation}`,
        timeout: 10_000,
        period,
      }),
    );

    return result.data.length > 0 ? ensureNumber(result.data[0].total) : 0;
  }

  async getTopOperationsForTypes(args: {
    targetId: string;
    period: DateRange;
    limit: number;
    typeNames: readonly string[];
  }): Promise<
    Map<
      string,
      Array<{
        operationName: string;
        operationHash: string;
        count: number;
      }>
    >
  > {
    const result = await this.clickHouse.query<{
      total: string;
      hash: string;
      name: string;
      coordinate: string;
    }>(
      this.pickAggregationByPeriod({
        queryId(aggregation) {
          return `get_top_operations_for_types_${aggregation}`;
        },
        query: aggregationTableName => sql`
          WITH coordinates as (
            SELECT cd.total, cd.hash, cd.coordinate
            FROM (
              SELECT
                sum(cdi.total) as total, cdi.hash as hash, cdi.coordinate as coordinate
              FROM ${aggregationTableName('coordinates')} as cdi
                ${this.createFilter({
                  target: args.targetId,
                  period: args.period,
                  extra: [
                    sql`cdi.coordinate NOT LIKE '%.%.%'`,
                    sql`substringIndex(cdi.coordinate, '.', 1) IN (${sql.array(args.typeNames, 'String')})`,
                  ],
                  namespace: 'cdi',
                })}
              GROUP BY cdi.hash, cdi.coordinate ORDER by total DESC, cdi.hash ASC LIMIT ${sql.raw(
                String(args.limit),
              )} by cdi.coordinate
            ) as cd
          )
          SELECT total, hash, coordinate, ocd.name
          FROM coordinates as c LEFT JOIN (
              SELECT ocd.name, ocd.hash
              FROM operation_collection_details as ocd
              WHERE ocd.target = ${args.targetId} AND hash IN (SELECT hash FROM coordinates)
              LIMIT 1 BY ocd.hash
          ) as ocd ON ocd.hash = c.hash
        `,
        period: args.period,
        timeout: 15_000,
      }),
    );

    const coordinateToTopOperations = new Map<
      string,
      Array<{
        operationName: string;
        operationHash: string;
        count: number;
      }>
    >();
    for (const row of result.data) {
      const existing = coordinateToTopOperations.get(row.coordinate);
      const op = {
        operationName: row.name,
        operationHash: row.hash,
        count: ensureNumber(row.total),
      };

      if (existing) {
        existing.push(op);
      } else {
        coordinateToTopOperations.set(row.coordinate, [op]);
      }
    }

    return coordinateToTopOperations;
  }

  async getClientNamesPerCoorinateOfTypes(
    targetId: string,
    period: DateRange,
    coordinates: readonly string[],
  ): Promise<Map<string, Set<string>>> {
    const dbResult = await this.clickHouse.query(
      this.pickAggregationByPeriod({
        queryId: aggregation => `get_client_names_for_schema_coordinates_${aggregation}`,
        // KAMIL: I know this query is a bit weird, but it's the best I could come up with.
        // It processed 27x less rows than the previous version.
        // It's 30x faster.
        // It consumes 36x less memory (~8MB).
        // It obviously depends on the amount of original data, but I tested it on a multiple datasets
        // and the ratio is always similar.
        // I'm open to suggestions on how to improve it.
        //
        // What the query does is:
        // 1. Fetches all coordinates of a given type, with associated operation hashes.
        // 2. Fetches all client names (groups them by hash) of a given hash.
        // 3. Groups rows by coordinate.
        // 4. Merges client names and removes duplicates.
        //
        // Why it's faster then the previous version?
        // It's using sub queries instead of joins (yeah there is a join but with preselected list of rows).
        // It fetches much less data.
        // It fetches rows more accurately.
        query: aggregationTableName => sql`
          SELECT
            co.coordinate AS coordinate,
            groupUniqArrayArray(cl.client_names) AS client_names
          FROM
          (
            SELECT
              co.coordinate,
              co.hash
            FROM ${aggregationTableName('coordinates')} AS co
            ${this.createFilter({
              target: targetId,
              period: period,
              extra: [sql`co.coordinate IN (${sql.array(coordinates, 'String')})`],
              namespace: 'co',
            })}
            GROUP BY co.coordinate, co.hash
          ) AS co
          LEFT JOIN
          (
              SELECT
                arrayDistinct(groupArray(client_name)) AS client_names,
                cl.hash AS hash
              FROM ${aggregationTableName('clients')} AS cl
              ${this.createFilter({
                target: targetId,
                period: period,
                namespace: 'cl',
              })}
              GROUP BY cl.hash
          ) AS cl ON co.hash = cl.hash
          GROUP BY co.coordinate
          SETTINGS join_algorithm = 'parallel_hash'
        `,
        timeout: 15_000,
        period,
      }),
    );

    const list = CoordinateClientNamesGroupModel.parse(dbResult.data);
    return new Map<string, Set<string>>(
      list.map(item => [item.coordinate, new Set(item.client_names)]),
    );
  }

  async readUniqueClientNames({
    target,
    period,
    operations,
  }: {
    target: string | readonly string[];
    period: DateRange;
    operations?: readonly string[];
  }): Promise<
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
    });

    return result.data.map(row => {
      return {
        name: row.client_name,
        count: ensureNumber(row.count),
      };
    });
  }

  async requestsOverTimeOfTargets(
    selectors: ReadonlyArray<{
      targets: readonly string[];
      period: DateRange;
      resolution: number;
    }>,
  ) {
    const aggregationMap = new Map<
      string,
      {
        targets: string[];
        period: DateRange;
        resolution: number;
      }
    >();

    const makeKey = (selector: { period: DateRange; resolution: number }) =>
      `${selector.period.from.toISOString()};${selector.period.to.toISOString()};${
        selector.resolution
      }`;

    const subSelectors = selectors
      .map(selector =>
        selector.targets.map(target => ({
          target,
          period: selector.period,
          resolution: selector.resolution,
        })),
      )
      .flat(1);

    // The idea here is to make the least possible number of queries to ClickHouse
    // by fetching all data points of the same target, period and resolution.
    for (const selector of subSelectors) {
      const key = makeKey(selector);
      const value = aggregationMap.get(key);

      if (!value) {
        aggregationMap.set(key, {
          targets: [selector.target],
          period: selector.period,
          resolution: selector.resolution,
        });
      } else {
        value.targets.push(selector.target);
      }
    }

    const aggregationResultMap = new Map<
      string,
      Promise<
        readonly {
          date: number;
          total: number;
          target: string;
        }[]
      >
    >();

    for (const [key, { targets, period, resolution }] of aggregationMap) {
      const interval = calculateTimeWindow({ period, resolution });
      const intervalRaw = this.clickHouse.translateWindow(interval);
      const roundedPeriod = {
        from: toStartOfInterval(period.from, interval.value, interval.unit),
        to: toEndOfInterval(period.to, interval.value, interval.unit),
      };
      const startDateTimeFormatted = formatDate(roundedPeriod.from);
      const endDateTimeFormatted = formatDate(roundedPeriod.to);

      aggregationResultMap.set(
        key,
        this.clickHouse
          .query<{
            date: string;
            target: string;
            total: number;
          }>(
            this.pickAggregationByPeriod({
              query: aggregationTableName => sql`
                SELECT
                  toDateTime(
                      intDiv(
                        toUnixTimestamp(timestamp),
                        toUInt32(${String(interval.seconds)})
                      ) * toUInt32(${String(interval.seconds)})
                  ) as date,
                  sum(total) as total,
                  target
                FROM ${aggregationTableName('operations')}
                ${this.createFilter({ target: targets, period: roundedPeriod })}
                GROUP BY target, date
                ORDER BY
                  target,
                  date
                    WITH FILL
                      FROM toDateTime(${startDateTimeFormatted}, 'UTC')
                      TO toDateTime(${endDateTimeFormatted}, 'UTC')
                      STEP INTERVAL ${intervalRaw}
              `,
              queryId: aggregation => `targets_count_over_time_${aggregation}`,
              timeout: 15_000,
              period,
              resolution,
            }),
          )
          .then(result =>
            result.data.map(row => ({
              date: toUnixTimestamp(row.date),
              total: row.total,
              target: row.target,
            })),
          ),
      );
    }

    // Because the function is used in a DataLoader,
    // it has to return a list of promises matching the order of selectors.
    return Promise.all(
      selectors.map(async selector => {
        const key = makeKey(selector);

        const queryPromise = aggregationResultMap.get(key);

        if (!queryPromise) {
          throw new Error(`Could not find data for ${key} selector`);
        }

        const rows = await queryPromise;

        const resultsPerTarget: {
          [target: string]: Array<{
            date: any;
            value: number;
          }>;
        } = {};

        for (const row of rows) {
          if (!selector.targets.includes(row.target)) {
            // it's not relevant to the current selector
            continue;
          }

          if (!resultsPerTarget[row.target]) {
            resultsPerTarget[row.target] = [];
          }

          resultsPerTarget[row.target].push({
            date: ensureNumber(row.date) as any,
            value: ensureNumber(row.total),
          });
        }

        return resultsPerTarget;
      }),
    );
  }

  async requestsOverTime({
    target,
    period,
    resolution,
    operations,
    clients,
    clientVersionFilters,
    excludeOperations,
    excludeClientVersionFilters,
    schemaCoordinate,
  }: {
    target: string;
    period: DateRange;
    resolution: number;
    operations?: readonly string[];
    clients?: readonly string[];
    clientVersionFilters?: readonly { clientName: string; versions: readonly string[] | null }[];
    excludeOperations?: boolean;
    excludeClientVersionFilters?: boolean;
    schemaCoordinate?: string;
  }) {
    const results = await this.getDurationAndCountOverTime({
      target,
      period,
      resolution,
      operations,
      clients,
      clientVersionFilters,
      excludeOperations,
      excludeClientVersionFilters,
      schemaCoordinate,
    });

    return results.map(row => ({
      date: row.date,
      value: row.total,
    }));
  }

  async failuresOverTime({
    target,
    period,
    resolution,
    operations,
    clients,
    clientVersionFilters,
    excludeOperations,
    excludeClientVersionFilters,
  }: {
    target: string;
    period: DateRange;
    resolution: number;
    operations?: readonly string[];
    clients?: readonly string[];
    clientVersionFilters?: readonly { clientName: string; versions: readonly string[] | null }[];
    excludeOperations?: boolean;
    excludeClientVersionFilters?: boolean;
  }) {
    const result = await this.getDurationAndCountOverTime({
      target,
      period,
      resolution,
      operations,
      clients,
      clientVersionFilters,
      excludeOperations,
      excludeClientVersionFilters,
    });

    return result.map(row => ({
      date: row.date,
      value: row.total - row.totalOk,
    }));
  }

  async durationOverTime({
    target,
    period,
    resolution,
    operations,
    clients,
    clientVersionFilters,
    excludeOperations,
    excludeClientVersionFilters,
  }: {
    target: string;
    period: DateRange;
    resolution: number;
    clientVersionFilters?: readonly { clientName: string; versions: readonly string[] | null }[];
    excludeOperations?: boolean;
    excludeClientVersionFilters?: boolean;
    operations?: readonly string[];
    clients?: readonly string[];
  }): Promise<
    Array<{
      date: any;
      duration: DurationMetrics;
    }>
  > {
    return this.getDurationAndCountOverTime({
      target,
      period,
      resolution,
      operations,
      clients,
      clientVersionFilters,
      excludeOperations,
      excludeClientVersionFilters,
    });
  }

  async generalDurationPercentiles({
    target,
    period,
    operations,
    clients,
    clientVersionFilters,
    excludeOperations,
    excludeClientVersionFilters,
  }: {
    target: string;
    period: DateRange;
    operations?: readonly string[];
    clients?: readonly string[];
    clientVersionFilters?: readonly { clientName: string; versions: readonly string[] | null }[];
    excludeOperations?: boolean;
    excludeClientVersionFilters?: boolean;
  }): Promise<DurationMetrics> {
    const result = await this.clickHouse.query<{
      percentiles: [number, number, number, number];
      average: number;
    }>(
      this.pickAggregationByPeriod({
        query: aggregationTableName => sql`
          SELECT
            avgMerge(duration_avg) as average,
            quantilesMerge(0.75, 0.90, 0.95, 0.99)(duration_quantiles) as percentiles
          FROM ${aggregationTableName('operations')}
            ${this.createFilter({ target, period, operations, clients, clientVersionFilters, excludeOperations, excludeClientVersionFilters })}
        `,
        queryId: aggregation => `general_duration_percentiles_${aggregation}`,
        timeout: 15_000,
        period,
      }),
    );

    return toDurationMetrics(result.data[0].percentiles, result.data[0].average);
  }

  async durationMetrics({
    target,
    period,
    operations,
    clients,
    clientVersionFilters,
    excludeOperations,
    excludeClientVersionFilters,
    schemaCoordinate,
  }: {
    clientVersionFilters?: readonly { clientName: string; versions: readonly string[] | null }[];
    excludeOperations?: boolean;
    excludeClientVersionFilters?: boolean;
    target: string;
    period: DateRange;
    operations?: readonly string[];
    clients?: readonly string[];
    schemaCoordinate?: string;
  }) {
    const result = await this.clickHouse.query<{
      hash: string;
      average: number;
      percentiles: [number, number, number, number];
    }>(
      this.pickAggregationByPeriod({
        query: aggregationTableName => sql`
              SELECT
                hash,
                avgMerge(duration_avg) as average,
                quantilesMerge(0.75, 0.90, 0.95, 0.99)(duration_quantiles) as percentiles
              FROM ${aggregationTableName('operations')}
              ${this.createFilter({
                target,
                period,
                operations,
                clients,
                clientVersionFilters,
                excludeOperations,
                excludeClientVersionFilters,
                extra: schemaCoordinate
                  ? [
                      sql`hash IN (SELECT hash FROM ${aggregationTableName('coordinates')} ${this.createFilter(
                        {
                          target,
                          period,
                          extra: [sql`coordinate = ${schemaCoordinate}`],
                        },
                      )})`,
                    ]
                  : [],
              })}
              GROUP BY hash
            `,
        queryId: aggregation => `duration_percentiles_${aggregation}`,
        timeout: 15_000,
        period,
      }),
    );

    const collection = new Map<string, DurationMetrics>();

    result.data.forEach(row => {
      collection.set(row.hash, toDurationMetrics(row.percentiles, row.average));
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
    }>(
      this.pickAggregationByPeriod({
        queryId: aggregation => `client_names_per_target_${aggregation}`,
        query: aggregationTableName => sql`
        SELECT client_name FROM ${aggregationTableName('clients')} ${this.createFilter({
          target,
          period,
        })} GROUP BY client_name
      `,
        timeout: 10_000,
        period,
      }),
    );

    return result.data.map(row => row.client_name);
  }

  /**
   * Use the coordinate_counts_daily table to check if any field usage data
   * has been ingested for the target. This can be used in conjunction with
   * the feature flag to appropriately display frontend components or opt
   * to hide them instead.
   */
  async coordinatesDataSyncedCheck({ targetId }: { targetId: string }): Promise<FieldMetricsState> {
    // assume expiration applies equally across the metric tables and so there's no need
    // to limit the timestamps

    const startedSendingFieldUsageAt = await this.clickHouse
      .query<{
        timestamp: string;
      }>({
        query: sql`
        SELECT MIN(timestamp) as timestamp
        FROM target_field_level_metrics_onboard_timestamp
        PREWHERE target = ${targetId}
      `,
        queryId: 'coordinate_data_synced_coords',
        // set a quick timeout to avoid inconvenience
        timeout: 3_000,
      })
      .then(r => {
        const maybeRow = r.data[0];
        return maybeRow ? toUnixTimestamp(maybeRow.timestamp) : null;
      });

    if (!startedSendingFieldUsageAt) {
      return FieldMetricsState.NO_DATA;
    }

    const operationsStart = await this.clickHouse
      .query<{
        startTime: string;
      }>({
        query: sql`
        SELECT MIN(timestamp) as startTime
        FROM operations_by_target_hourly
        PREWHERE
          target = ${targetId}
          AND timestamp < fromUnixTimestamp64Milli(${sql.raw(String(startedSendingFieldUsageAt))})
        LIMIT 1;
      `,
        queryId: 'coordinate_data_synced_operations',
        // set a quick timeout to avoid inconvenience
        timeout: 3_000,
      })
      .then(r => {
        const maybeRow = r.data[0];
        return maybeRow ? toUnixTimestamp(maybeRow.startTime) : null;
      });

    // check if any operations sent before the adjusted coordinate timestamp
    if (operationsStart === null) {
      // if no operation is found before this timestamp, then those operation records
      // must have been deleted via TTL. In this case, the field level metrics
      // and operation metrics are both limited by the TTL and are in sync.
      return FieldMetricsState.IN_SYNC;
    }
    // Else we know coordinate data and operation usage data mismatch.
    return FieldMetricsState.HISTORY_MISSING;
  }

  async getCoordinatesOverTime({
    targetId,
    period,
    resolution,
    schemaCoordinate,
  }: {
    targetId: string;
    period: DateRange;
    resolution: number;
    schemaCoordinate: string;
  }) {
    const interval = calculateTimeWindow({ period, resolution });
    const intervalRaw = this.clickHouse.translateWindow(interval);
    const roundedPeriod = {
      from: toStartOfInterval(period.from, interval.value, interval.unit),
      to: toEndOfInterval(period.to, interval.value, interval.unit),
    };
    const startDateTimeFormatted = formatDate(roundedPeriod.from);
    const endDateTimeFormatted = formatDate(roundedPeriod.to);

    const query = this.pickAggregationByPeriod({
      timeout: 15_000,
      period,
      resolution,
      queryId: aggregation => `coord_count_over_time_${aggregation}`,
      query: aggregationTableName => {
        return sql`
        SELECT
          date,
          total,
        FROM (
          SELECT
            toDateTime(
              intDiv(
                toUnixTimestamp(timestamp),
                toUInt32(${String(interval.seconds)})
              ) * toUInt32(${String(interval.seconds)})
            ) as date,
            sum(total) as total
          FROM ${aggregationTableName('coordinate_counts')}
          ${this.createFilter({
            target: targetId,
            period: roundedPeriod,
            extra: [sql`coordinate = ${schemaCoordinate}`],
          })}
          GROUP BY date
          ORDER BY date
          WITH FILL
            FROM toDateTime(${startDateTimeFormatted}, 'UTC')
            TO toDateTime(${endDateTimeFormatted}, 'UTC')
            STEP INTERVAL ${intervalRaw}
        )
      `;
      },
    });

    // multiply by 1000 to convert to milliseconds
    const result = await this.clickHouse.query<{
      date: string;
      total: number;
    }>(query);

    return result.data.map(row => {
      return {
        date: toUnixTimestamp(row.date),
        value: ensureNumber(row.total),
      };
    });
  }

  async getCoordinateFailuresOverTime({
    targetId,
    period,
    resolution,
    schemaCoordinate,
  }: {
    targetId: string;
    period: DateRange;
    resolution: number;
    schemaCoordinate: string;
  }) {
    const interval = calculateTimeWindow({ period, resolution });
    const intervalRaw = this.clickHouse.translateWindow(interval);
    const roundedPeriod = {
      from: toStartOfInterval(period.from, interval.value, interval.unit),
      to: toEndOfInterval(period.to, interval.value, interval.unit),
    };
    const startDateTimeFormatted = formatDate(roundedPeriod.from);
    const endDateTimeFormatted = formatDate(roundedPeriod.to);

    const query = this.pickAggregationByPeriod({
      timeout: 15_000,
      period,
      resolution,
      queryId: aggregation => `coord_failures_over_time_${aggregation}`,
      query: aggregationTableName => {
        return sql`
        SELECT
          date,
          total,
        FROM (
          SELECT
            toDateTime(
              intDiv(
                toUnixTimestamp(timestamp),
                toUInt32(${String(interval.seconds)})
              ) * toUInt32(${String(interval.seconds)})
            ) as date,
            sum(total_errors) as total
          FROM ${aggregationTableName('coordinate_errors')}
          ${this.createFilter({
            target: targetId,
            period: roundedPeriod,
            extra: [sql`coordinate = ${schemaCoordinate}`],
          })}
          GROUP BY date
          ORDER BY date
          WITH FILL
            FROM toDateTime(${startDateTimeFormatted}, 'UTC')
            TO toDateTime(${endDateTimeFormatted}, 'UTC')
            STEP INTERVAL ${intervalRaw}
        )
      `;
      },
    });

    // multiply by 1000 to convert to milliseconds
    const result = await this.clickHouse.query<{
      date: string;
      total: number;
    }>(query);

    return result.data.map(row => {
      return {
        date: toUnixTimestamp(row.date),
        value: ensureNumber(row.total),
      };
    });
  }

  private async getDurationAndCountOverTime({
    target,
    period,
    resolution,
    operations,
    clients,
    clientVersionFilters,
    excludeOperations,
    excludeClientVersionFilters,
    schemaCoordinate,
  }: {
    target: string;
    period: DateRange;
    resolution: number;
    operations?: readonly string[];
    clients?: readonly string[];
    clientVersionFilters?: readonly { clientName: string; versions: readonly string[] | null }[];
    excludeOperations?: boolean;
    excludeClientVersionFilters?: boolean;
    schemaCoordinate?: string;
  }) {
    const interval = calculateTimeWindow({ period, resolution });
    const intervalRaw = this.clickHouse.translateWindow(interval);
    const roundedPeriod = {
      from: toStartOfInterval(period.from, interval.value, interval.unit),
      to: toEndOfInterval(period.to, interval.value, interval.unit),
    };
    const startDateTimeFormatted = formatDate(roundedPeriod.from);
    const endDateTimeFormatted = formatDate(roundedPeriod.to);

    const query = this.pickAggregationByPeriod({
      timeout: 15_000,
      period,
      resolution,
      queryId: aggregation => `duration_and_count_over_time_${aggregation}`,
      query: aggregationTableName => {
        return sql`
        SELECT
          date,
          average,
          percentiles,
          total,
          totalOk
        FROM (
          SELECT
            toDateTime(
              intDiv(
                toUnixTimestamp(timestamp),
                toUInt32(${String(interval.seconds)})
              ) * toUInt32(${String(interval.seconds)})
            ) as date,
            avgMerge(duration_avg) as average,
            quantilesMerge(0.75, 0.90, 0.95, 0.99)(duration_quantiles) as percentiles,
            sum(total) as total,
            sum(total_ok) as totalOk
          FROM ${aggregationTableName('operations')}
          ${this.createFilter({
            target,
            period: roundedPeriod,
            operations,
            clients,
            clientVersionFilters,
            excludeOperations,
            excludeClientVersionFilters,
            extra: schemaCoordinate
              ? [
                  sql`hash IN (SELECT hash FROM ${aggregationTableName('coordinates')} ${this.createFilter(
                    {
                      target,
                      period: roundedPeriod,
                      extra: [sql`coordinate = ${schemaCoordinate}`],
                    },
                  )})`,
                ]
              : [],
          })}
          GROUP BY date
          ORDER BY date
          WITH FILL
            FROM toDateTime(${startDateTimeFormatted}, 'UTC')
            TO toDateTime(${endDateTimeFormatted}, 'UTC')
            STEP INTERVAL ${intervalRaw}
        )
      `;
      },
    });

    // multiply by 1000 to convert to milliseconds
    const result = await this.clickHouse.query<{
      date: string;
      total: number;
      totalOk: number;
      average: number;
      percentiles: [number, number, number, number];
    }>(query);

    return result.data.map(row => {
      return {
        date: toUnixTimestamp(row.date),
        total: ensureNumber(row.total),
        totalOk: ensureNumber(row.totalOk),
        duration: toDurationMetrics(row.percentiles, row.average),
      };
    });
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
        `${
          selector.target
        }-${selector.period.from.toISOString()}-${selector.period.to.toISOString()}`;

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
            totalResolutions: number | null;
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

    const query = this.pickAggregationByPeriod({
      query: aggregationTableName => sql`
      SELECT 
        coalesce(c.coordinate, r.coordinate) AS coordinate, 
        c.total AS total, 
        r.totalResolutions AS totalResolutions
      FROM
      (
        SELECT coordinate, sum(total) as total
        FROM ${aggregationTableName('coordinates')}
        ${this.createFilter({
          target,
          period,
          extra: [sql`(${sql.join(typesConditions, ' OR ')})`],
        })}
        GROUP BY coordinate
      ) AS c
      LEFT OUTER JOIN
      (
        SELECT coordinate, sum(total) as totalResolutions
        FROM ${aggregationTableName('coordinate_counts')}
        ${this.createFilter({
          target,
          period,
          extra: [sql`(${sql.join(typesConditions, ' OR ')})`],
        })}
        GROUP BY coordinate
      ) AS r
      ON c.coordinate = r.coordinate
      ;`,
      queryId: aggregation => `coordinates_per_types_${aggregation}`,
      timeout: 15_000,
      period,
    });

    const result = await this.clickHouse.query<{
      coordinate: string;
      total: number;
      totalResolutions?: number | null;
    }>(query);

    return result.data.map(row => ({
      coordinate: row.coordinate,
      total: ensureNumber(row.total),
      totalResolutions: row.totalResolutions ? ensureNumber(row.totalResolutions) : null,
    }));
  }

  // Identical to count coordinates, but for field errors
  /**
   * Counts the number of errors for a specific coordinate. This is the total resolved count.
   * Note that in a single request, one coordinate can have multiple errors.
   */
  countErrorCoordinatesOfType = batch(
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
        `${
          selector.target
        }-${selector.period.from.toISOString()}-${selector.period.to.toISOString()}`;

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
          this.countErrorCoordinatesOfTypes({
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

  private async countErrorCoordinatesOfTypes({
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
    }>(
      this.pickAggregationByPeriod({
        query: aggregationTableName => sql`
        SELECT coordinate, sum(total_errors) as total FROM ${aggregationTableName('coordinate_errors')}
        ${this.createFilter({
          target,
          period,
          extra: [sql`(${sql.join(typesConditions, ' OR ')})`],
        })}
        GROUP BY coordinate`,
        queryId: aggregation => `coordinates_per_types_${aggregation}`,
        timeout: 15_000,
        period,
      }),
    );

    return result.data.map(row => ({
      coordinate: row.coordinate,
      total: ensureNumber(row.total),
    }));
  }

  @traceFn('OperationReader.countCoordinatesOfTarget', {
    initAttributes: input => ({
      'hive.target.id': input.target,
    }),
  })
  async countCoordinatesOfTarget({ target, period }: { target: string; period: DateRange }) {
    this.logger.debug('Count coordinates of target. (targetId=%s, period=%o)', target, period);

    const result = await this.clickHouse.query<{
      coordinate: string;
      total: number;
    }>(
      this.pickAggregationByPeriod({
        query: aggregationTableName => sql`
        SELECT coordinate, sum(total) as total FROM ${aggregationTableName('coordinates')}
        ${this.createFilter({
          target,
          period,
        })}
        GROUP BY coordinate
      `,
        queryId: aggregation => `coordinates_per_target_${aggregation}`,
        timeout: 15_000,
        period,
      }),
    );

    this.logger.debug('%d rows found. (targetId=%s, period=%o)', result.rows, target, period);

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
    const result = await this.clickHouse.query<{
      total: string;
      target: string;
    }>(
      this.pickAggregationByPeriod({
        query: aggregationTableName => sql`
        SELECT
          sum(total) as total,
          target
        FROM ${aggregationTableName('operations')}
        PREWHERE
          timestamp >= toDateTime(${formatDate(period.from)}, 'UTC')
          AND
          timestamp <= toDateTime(${formatDate(period.to)}, 'UTC')
        GROUP BY target`,
        queryId: aggregation => `admin_operations_per_target_${aggregation}`,
        timeout: 15_000,
        period,
      }),
    );

    return result.data.map(row => ({
      total: ensureNumber(row.total),
      target: row.target,
    }));
  }

  async adminOperationsOverTime({
    period,
    resolution,
  }: {
    period: {
      from: Date;
      to: Date;
    };
    resolution: number;
  }) {
    const interval = calculateTimeWindow({ period, resolution });
    const intervalRaw = this.clickHouse.translateWindow(interval);
    const roundedPeriod = {
      from: toStartOfInterval(period.from, interval.value, interval.unit),
      to: toEndOfInterval(period.to, interval.value, interval.unit),
    };
    const startDateTimeFormatted = formatDate(roundedPeriod.from);
    const endDateTimeFormatted = formatDate(roundedPeriod.to);

    const result = await this.clickHouse.query<{
      date: string;
      total: string;
    }>(
      this.pickAggregationByPeriod({
        query: aggregationTableName => sql`
        SELECT
          toDateTime(
            intDiv(
              toUnixTimestamp(timestamp),
              toUInt32(${String(interval.seconds)})
            ) * toUInt32(${String(interval.seconds)})
          ) as date,
          sum(total) as total
        FROM ${aggregationTableName('operations')}
        ${this.createFilter({ period: roundedPeriod })}
        GROUP BY date
        ORDER BY date
          WITH FILL
            FROM toDateTime(${startDateTimeFormatted}, 'UTC')
            TO toDateTime(${endDateTimeFormatted}, 'UTC')
            STEP INTERVAL ${intervalRaw}
      `,
        queryId: aggregation => `admin_operations_per_target_${aggregation}`,
        timeout: 15_000,
        period,
        resolution,
      }),
    );

    return result.data.map(row => ({
      date: toUnixTimestamp(row.date),
      total: ensureNumber(row.total),
    }));
  }

  async errorCodesAtSchemaCoordinate({
    period,
    target,
    schemaCoordinate,
  }: {
    period: {
      from: Date;
      to: Date;
    };
    target: string;
    schemaCoordinate: string;
  }) {
    const result = await this.clickHouse.query<{
      count: number;
      code: string;
    }>(
      this.pickAggregationByPeriod({
        query: aggregationTableName => sql`
        SELECT
          sum(total_errors) as count,
          code
        FROM ${aggregationTableName('coordinate_errors')}
        PREWHERE
          timestamp >= toDateTime(${formatDate(period.from)}, 'UTC')
          AND
          timestamp <= toDateTime(${formatDate(period.to)}, 'UTC')
          AND
          target = ${target}
          AND
          coordinate = ${schemaCoordinate}
        GROUP BY code`,
        queryId: aggregation => `error_codes_at_schema_coordinate_${aggregation}`,
        timeout: 15_000,
        period,
      }),
    );
    return result.data.map(d => ({
      count: ensureNumber(d.count),
      code: d.code,
    }));
  }

  async errorCodesOverTimeAtSchemaCoordinate({
    schemaCoordinate,
    target,
    period,
    resolution,
  }: {
    schemaCoordinate: string;
    target: string;
    period: {
      from: Date;
      to: Date;
    };
    resolution: number;
  }) {
    const interval = calculateTimeWindow({ period, resolution });
    const intervalRaw = this.clickHouse.translateWindow(interval);
    const roundedPeriod = {
      from: toStartOfInterval(period.from, interval.value, interval.unit),
      to: toEndOfInterval(period.to, interval.value, interval.unit),
    };
    const startDateTimeFormatted = formatDate(roundedPeriod.from);
    const endDateTimeFormatted = formatDate(roundedPeriod.to);

    const result = await this.clickHouse.query<{
      date: string;
      code: string;
      count: string;
    }>(
      this.pickAggregationByPeriod({
        query: aggregationTableName => sql`
        SELECT
          toDateTime(
            intDiv(
              toUnixTimestamp(timestamp),
              toUInt32(${String(interval.seconds)})
            ) * toUInt32(${String(interval.seconds)})
          ) as date,
          code,
          sum(total_errors) as count
        FROM ${aggregationTableName('coordinate_errors')}
        ${this.createFilter({
          period: roundedPeriod,
          target,
          extra: [sql`coordinate=${schemaCoordinate}`],
        })}
        GROUP BY code, date
        ORDER BY code, date
          WITH FILL
            FROM toDateTime(${startDateTimeFormatted}, 'UTC')
            TO toDateTime(${endDateTimeFormatted}, 'UTC')
            STEP INTERVAL ${intervalRaw}
      `,
        queryId: aggregation => `error_codes_over_time_at_${aggregation}`,
        timeout: 15_000,
        period,
        resolution,
      }),
    );

    return result.data.map(row => ({
      code: row.code,
      date: toUnixTimestamp(row.date),
      count: ensureNumber(row.count),
    }));
  }

  public createFilter({
    target,
    period,
    operations,
    clients,
    clientVersionFilters,
    excludeOperations,
    excludeClientVersionFilters,
    extra = [],
    skipWhere = false,
    namespace,
  }: {
    target?: string | readonly string[];
    period?: DateRange;
    operations?: readonly string[];
    clients?: readonly string[];
    clientVersionFilters?: readonly { clientName: string; versions: readonly string[] | null }[];
    excludeOperations?: boolean;
    excludeClientVersionFilters?: boolean;
    extra?: SqlValue[];
    skipWhere?: boolean;
    namespace?: string;
  }): SqlValue {
    const where: SqlValue[] = [];

    const columnPrefix = sql.raw(namespace ? `${namespace}.` : '');

    if (target) {
      if (Array.isArray(target)) {
        where.push(sql`${columnPrefix}target IN (${sql.array(target, 'String')})`);
      } else {
        where.push(sql`${columnPrefix}target = ${target as string}`);
      }
    }

    if (period) {
      where.push(
        sql`${columnPrefix}timestamp >= toDateTime(${formatDate(period.from)}, 'UTC')`,
        sql`${columnPrefix}timestamp <= toDateTime(${formatDate(period.to)}, 'UTC')`,
      );
    }

    // Operation-hash + client(/version) conditions are built by the shared
    // `@hive/clickhouse` helper so the API and the metric-alert worker filter
    // identically. `target`/`period`/`extra`/PREWHERE remain createFilter's concern.
    where.push(
      ...buildOperationsFilterSQLConditions({
        operations,
        clients,
        clientVersionFilters,
        excludeOperations,
        excludeClientVersionFilters,
        namespace,
      }),
    );

    if (extra.length) {
      where.push(...extra);
    }

    const statement = where.length
      ? sql` ${sql.raw(skipWhere ? '' : 'PREWHERE')} ${sql.join(where, ' AND ')} `
      : sql``;

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

/** Drops empty rows; most requests first. */
function groupByKey<T extends { key: string; count: number }>(rows: T[]) {
  const groups = new Map<string, Array<Omit<T, 'key'>>>();
  for (const { key, ...row } of rows) {
    if (row.count <= 0) {
      continue;
    }
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }
  for (const group of groups.values()) {
    group.sort((a, b) => b.count - a.count);
  }
  return groups;
}
