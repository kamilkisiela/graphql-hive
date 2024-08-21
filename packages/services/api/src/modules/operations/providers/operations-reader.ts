import { addMinutes, format } from 'date-fns';
import { Injectable } from 'graphql-modules';
import * as z from 'zod';
import { UTCDate } from '@date-fns/utc';
import { batch } from '@theguild/buddy';
import type { DateRange } from '../../../shared/entities';
import { batchBy } from '../../../shared/helpers';
import { Logger } from '../../shared/providers/logger';
import { toEndOfInterval, toStartOfInterval } from '../lib/date-time-helpers';
import { pickTableByPeriod } from '../lib/pick-table-by-provider';
import { ClickHouse, RowOf, sql } from './clickhouse-client';
import { calculateTimeWindow } from './helpers';
import { RawValue, SqlValue } from './sql';

const CoordinateClientNamesGroupModel = z.array(
  z.object({
    coordinate: z.string(),
    client_names: z.array(z.string()),
  }),
);

function formatDate(date: Date): string {
  return format(addMinutes(date, date.getTimezoneOffset()), 'yyyy-MM-dd HH:mm:ss');
}

function toUnixTimestamp(utcDate: string): any {
  // 2024-04-26 11:00:00
  const [date, time] = utcDate.split(' ');
  const [year, month, day] = date.split('-');
  const [hour, minute, second] = time.split(':');
  const iso = `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;

  return new UTCDate(iso).getTime();
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
      aggregationTableName: (tableName: 'operations' | 'clients' | 'coordinates') => RawValue,
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
    const coordinates = fields.map(selector => this.makeId(selector));
    const conditions = [sql`(coordinate IN (${sql.array(coordinates, 'String')}))`];

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
              target,
              period,
            })}
            GROUP BY hash
          ) WHERE non_excluded_clients_total = 0
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
    schemaCoordinate,
  }: {
    target: string | readonly string[];
    period: DateRange;
    operations?: readonly string[];
    clients?: readonly string[];
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
  }: {
    target: string;
    period: DateRange;
    operations?: readonly string[];
    clients?: readonly string[];
  }): Promise<number> {
    return this.countRequests({ target, period, operations, clients }).then(r => r.notOk);
  }

  async countUniqueDocuments({
    target,
    period,
    operations,
    clients,
  }: {
    target: string;
    period: DateRange;
    operations?: readonly string[];
    clients?: readonly string[];
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
    schemaCoordinate,
  }: {
    target: string;
    period: DateRange;
    operations?: readonly string[];
    clients?: readonly string[];
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

  async readOperation({ target, hash }: { target: string; hash: string }) {
    const result = await this.clickHouse.query<{
      hash: string;
      body: string;
      name: string;
      type: 'query' | 'mutation' | 'subscription';
    }>({
      query: sql`
        SELECT 
          "operation_collection_details"."hash" AS "hash",
          "operation_collection_details"."operation_kind" AS "type",
          "operation_collection_details"."name" AS "name",
          "body_join"."body" AS "body"
        FROM "operation_collection_details"
        RIGHT JOIN (
          SELECT
            "operation_collection_body"."hash" AS "hash",
            "operation_collection_body"."body" AS "body"
          FROM "operation_collection_body"
            ${this.createFilter({
              target,
              extra: [sql`"operation_collection_body"."hash" = ${hash}`],
              namespace: 'operation_collection_body',
            })}
          LIMIT 1
        ) AS "body_join"
          ON "operation_collection_details"."hash" = "body_join"."hash"
          ${this.createFilter({
            target,
            extra: [sql`"operation_collection_details"."hash" = ${hash}`],
            namespace: 'operation_collection_details',
          })}
        LIMIT 1
        SETTINGS allow_asynchronous_read_from_io_pool_for_merge_tree = 1
      `,
      queryId: 'read_body',
      timeout: 10_000,
    });

    return result.data.length ? result.data[0] : null;
  }

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
    schemaCoordinate,
  }: {
    target: string;
    period: DateRange;
    operations?: readonly string[];
    clients?: readonly string[];
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
    requestCountThreshold: number;
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
            HAVING "total" >= ${String(args.requestCountThreshold)}
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
      requestCountThreshold: number;
    },
    Array<{
      hash: string;
      name: string;
      count: number;
    }> | null
  >(
    item =>
      `${item.targetIds.join(',')}-${item.excludedClients?.join(',') ?? ''}-${item.period.from.toISOString()}-${item.period.to.toISOString()}-${item.requestCountThreshold}`,
    async items => {
      const schemaCoordinates = items.map(item => item.schemaCoordinate);
      return await this._getTopOperationsForSchemaCoordinates({
        targetIds: items[0].targetIds,
        excludedClients: items[0].excludedClients,
        period: items[0].period,
        requestCountThreshold: items[0].requestCountThreshold,
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
    const ORs = args.typeNames.map(
      typeName => sql`( cdi.coordinate = ${typeName} OR cdi.coordinate LIKE ${typeName + '.%'} )`,
    );

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
                  extra: [sql`cdi.coordinate NOT LIKE '%.%.%'`, sql`(${sql.join(ORs, ' OR ')})`],
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

  async getClientNamesPerCoordinateOfType(args: {
    targetId: string;
    period: DateRange;
    typename: string;
  }): Promise<Map<string, Set<string>>> {
    // The Explorer page is the only consumer of this method.
    // It displays:
    // - a list of fields of a given (interface, input object, object) type (in this case we can use Type.*)
    // - a list of fields of root types (in this case we can use Query.*, Mutation.*, Subscription.*)
    // - enums (in this case we can use Enum.* + Enum)
    // - union (in this case we can use Union.* + Union)
    // - scalar (in this case we can use Scalar)
    // We clearly over-fetch here as we fetch all coordinates of a given type,
    // even though some coordinates may no longer be used in the schema.
    // But it's a fine tradeoff for the sake of simplicity.

    const dbResult = await this.clickHouse.query(
      this.pickAggregationByPeriod({
        queryId: aggregation => `get_hashes_for_schema_coordinates_${aggregation}`,
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
              target: args.targetId,
              period: args.period,
              extra: [
                sql`( co.coordinate = ${args.typename} OR co.coordinate LIKE ${
                  args.typename + '.%'
                } )`,
              ],
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
                target: args.targetId,
                period: args.period,
                namespace: 'cl',
              })}
              GROUP BY cl.hash
          ) AS cl ON co.hash = cl.hash
          GROUP BY co.coordinate
          SETTINGS join_algorithm = 'parallel_hash'
        `,
        timeout: 15_000,
        period: args.period,
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
    schemaCoordinate,
  }: {
    target: string;
    period: DateRange;
    resolution: number;
    operations?: readonly string[];
    clients?: readonly string[];
    schemaCoordinate?: string;
  }) {
    const results = await this.getDurationAndCountOverTime({
      target,
      period,
      resolution,
      operations,
      clients,
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
  }: {
    target: string;
    period: DateRange;
    resolution: number;
    operations?: readonly string[];
    clients?: readonly string[];
  }) {
    const result = await this.getDurationAndCountOverTime({
      target,
      period,
      resolution,
      operations,
      clients,
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
  }: {
    target: string;
    period: DateRange;
    resolution: number;
    operations?: readonly string[];
    clients?: readonly string[];
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
      clients,
    });
  }

  async generalDurationPercentiles({
    target,
    period,
    operations,
    clients,
  }: {
    target: string;
    period: DateRange;
    operations?: readonly string[];
    clients?: readonly string[];
  }): Promise<Percentiles> {
    const result = await this.clickHouse.query<{
      percentiles: [number, number, number, number];
    }>(
      this.pickAggregationByPeriod({
        query: aggregationTableName => sql`
          SELECT 
            quantilesMerge(0.75, 0.90, 0.95, 0.99)(duration_quantiles) as percentiles
          FROM ${aggregationTableName('operations')}
            ${this.createFilter({ target, period, operations, clients })}
        `,
        queryId: aggregation => `general_duration_percentiles_${aggregation}`,
        timeout: 15_000,
        period,
      }),
    );

    return toPercentiles(result.data[0].percentiles);
  }

  async durationPercentiles({
    target,
    period,
    operations,
    clients,
    schemaCoordinate,
  }: {
    target: string;
    period: DateRange;
    operations?: readonly string[];
    clients?: readonly string[];
    schemaCoordinate?: string;
  }) {
    const result = await this.clickHouse.query<{
      hash: string;
      percentiles: [number, number, number, number];
    }>(
      this.pickAggregationByPeriod({
        query: aggregationTableName => sql`
              SELECT 
                hash,
                quantilesMerge(0.75, 0.90, 0.95, 0.99)(duration_quantiles) as percentiles
              FROM ${aggregationTableName('operations')}
              ${this.createFilter({
                target,
                period,
                operations,
                clients,
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

  private async getDurationAndCountOverTime({
    target,
    period,
    resolution,
    operations,
    clients,
    schemaCoordinate,
  }: {
    target: string;
    period: DateRange;
    resolution: number;
    operations?: readonly string[];
    clients?: readonly string[];
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
            quantilesMerge(0.75, 0.90, 0.95, 0.99)(duration_quantiles) as percentiles,
            sum(total) as total,
            sum(total_ok) as totalOk
          FROM ${aggregationTableName('operations')}
          ${this.createFilter({
            target,
            period: roundedPeriod,
            operations,
            clients,
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
      percentiles: [number, number, number, number];
    }>(query);

    return result.data.map(row => {
      return {
        date: toUnixTimestamp(row.date),
        total: ensureNumber(row.total),
        totalOk: ensureNumber(row.totalOk),
        duration: toPercentiles(row.percentiles),
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
    }>(
      this.pickAggregationByPeriod({
        query: aggregationTableName => sql`
        SELECT coordinate, sum(total) as total FROM ${aggregationTableName('coordinates')}
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

  async countCoordinatesOfTarget({ target, period }: { target: string; period: DateRange }) {
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

  public createFilter({
    target,
    period,
    operations,
    clients,
    extra = [],
    skipWhere = false,
    namespace,
  }: {
    target?: string | readonly string[];
    period?: DateRange;
    operations?: readonly string[];
    clients?: readonly string[];
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

    if (operations?.length) {
      where.push(sql`(${columnPrefix}hash) IN (${sql.array(operations, 'String')})`);
    }

    if (clients?.length) {
      where.push(sql`${sql.raw(namespace ?? '')}client_name IN (${sql.array(clients, 'String')})`);
    }

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
