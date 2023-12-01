import {
  addMinutes,
  differenceInDays,
  format,
  startOfDay,
  startOfHour,
  startOfMinute,
  subHours,
  subMinutes,
} from 'date-fns';
import { Injectable } from 'graphql-modules';
import * as z from 'zod';
import { batch } from '@theguild/buddy';
import type { DateRange } from '../../../shared/entities';
import { Logger } from '../../shared/providers/logger';
import { ClickHouse, RowOf, sql } from './clickhouse-client';
import { calculateTimeWindow } from './helpers';
import { SqlValue } from './sql';

const CoordinateClientNamesGroupModel = z.array(
  z.object({
    coordinate: z.string(),
    client_names: z.array(z.string()),
  }),
);

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

@Injectable({
  global: true,
})
export class OperationsReader {
  constructor(
    private clickHouse: ClickHouse,
    private logger: Logger,
  ) {}

  private pickQueryByPeriod(
    queryMap: {
      hourly: {
        query: SqlValue;
        queryId: string;
        timeout: number;
      };
      daily: {
        query: SqlValue;
        queryId: string;
        timeout: number;
      };
      minutely: {
        query: SqlValue;
        queryId: string;
        timeout: number;
      };
    },
    period: DateRange | null,
    resolution?: number,
  ) {
    if (!period) {
      return {
        ...queryMap.daily,
        queryType: 'daily' as const,
      };
    }

    const dataPoints = resolution;
    const timeDifference = period.to.getTime() - period.from.getTime();
    const timeDifferenceInHours = timeDifference / 1000 / 60 / 60;
    const timeDifferenceInDays = timeDifference / 1000 / 60 / 60 / 24;

    // How long rows are kept in the database, per table.
    const tableTTLInHours = {
      daily: 365 * 24,
      hourly: 30 * 24,
      minutely: 24,
    };

    // The oldest data point we can fetch from the database, per table.
    // ! We subtract 2 minutes as we round the date to the nearest minute on UI
    //   and there's also a chance that request will be made at 59th second of the minute
    //   and by the time it this function is called the minute will change.
    //   That's why we use 2 minutes as a buffer.
    const tableOldestDateTimePoint = {
      daily: subMinutes(startOfDay(subHours(new Date(), tableTTLInHours.daily)), 2),
      hourly: subMinutes(startOfHour(subHours(new Date(), tableTTLInHours.hourly)), 2),
      minutely: subMinutes(startOfMinute(subHours(new Date(), tableTTLInHours.minutely)), 2),
    };

    let selectedQueryType: 'daily' | 'hourly' | 'minutely';

    // If the user requested a specific resolution, we need to pick the right table.
    //
    if (dataPoints) {
      const interval = calculateTimeWindow({ period, resolution });

      if (timeDifferenceInDays >= dataPoints) {
        // If user selected a date range of 60 days or more and requested 30 data points
        // we can use daily table as each data point represents at least 1 day.
        selectedQueryType = 'daily';

        if (interval.unit !== 'd') {
          this.logger.error(
            `Calculated interval ${interval.value}${
              interval.unit
            } for the requested date range ${formatDate(period.from)} - ${formatDate(
              period.to,
            )} does not satisfy the daily table.`,
          );
          throw new Error(`Invalid number of data points for the requested date range`);
        }
      } else if (timeDifferenceInHours >= dataPoints) {
        // Same as for daily table, but for hourly table.
        // If data point represents at least 1 full hour, use hourly table.
        selectedQueryType = 'hourly';

        if (interval.unit === 'm') {
          this.logger.error(
            `Calculated interval ${interval.value}${
              interval.unit
            } for the requested date range ${formatDate(period.from)} - ${formatDate(
              period.to,
            )} does not satisfy the hourly table.`,
          );
          throw new Error(`Invalid number of data points for the requested date range`);
        }
      } else {
        selectedQueryType = 'minutely';
      }
    } else if (timeDifferenceInHours > 24) {
      selectedQueryType = 'daily';
    } else if (timeDifferenceInHours > 1) {
      selectedQueryType = 'hourly';
    } else {
      selectedQueryType = 'minutely';
    }

    if (tableOldestDateTimePoint[selectedQueryType].getTime() > period.from.getTime()) {
      if (dataPoints) {
        // If the oldest data point is newer than the requested data range,
        // and the user requested a specific resolution
        const interval = calculateTimeWindow({ period, resolution });
        this.logger.error(
          `Requested date range ${formatDate(period.from)} - ${formatDate(
            period.to,
          )} is older than the oldest available data point ${formatDate(
            tableOldestDateTimePoint[selectedQueryType],
          )} for the selected query type ${selectedQueryType}. The requested resolution is ${
            interval.value
          } ${interval.unit}.`,
        );
        throw new Error(`The requested date range is too old for the selected query type.`);
      } else {
        // If the oldest data point is newer than the requested data range,
        // but the user didn't request a specific resolution, it's fine.
        this.logger.warn(
          `[OPERATIONS_READER_TTL_DATE_RANGE_WARN] The requested date range is too old for the selected query type. Requested date range ${formatDate(
            period.from,
          )} - ${formatDate(period.to)} is older than the oldest available data point ${formatDate(
            tableOldestDateTimePoint[selectedQueryType],
          )}`,
        );
      }
    }

    return {
      ...queryMap[selectedQueryType],
      queryType: selectedQueryType,
    };
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

  async countFields({
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
  }): Promise<Record<string, number>> {
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
            period
          })}
          GROUP BY hash
          HAVING COUNT(CASE WHEN client NOT IN (${sql.array(excludedClients, 'String')}) THEN 1 END) > 0
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
        SELECT 1 as exists FROM target_existence ${this.createFilter({
          target,
        })} GROUP BY target LIMIT 1
      `,
      queryId: 'has_collected_operations',
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
    const query = this.pickQueryByPeriod(
      {
        daily: {
          query: sql`SELECT sum(total) as total FROM operations_daily ${this.createFilter({
            target,
            period,
          })}`,
          queryId: 'count_operations_daily',
          timeout: 10_000,
        },
        hourly: {
          query: sql`SELECT sum(total) as total FROM operations_hourly ${this.createFilter({
            target,
            period,
          })}`,
          queryId: 'count_operations_hourly',
          timeout: 15_000,
        },
        minutely: {
          query: sql`SELECT sum(total) as total FROM operations_minutely ${this.createFilter({
            target,
            period,
          })}`,
          queryId: 'count_operations_regular',
          timeout: 30_000,
        },
      },
      period ?? null,
    );

    const result = await this.clickHouse.query<{
      total: number;
    }>(query);

    const total = ensureNumber(result.data[0].total);

    return total;
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
    const query = this.pickQueryByPeriod(
      {
        daily: {
          query: sql`SELECT sum(total) as total, sum(total_ok) as totalOk FROM operations_daily ${this.createFilter(
            {
              target,
              period,
              operations,
              clients,
              extra: schemaCoordinate
                ? [
                    sql`hash IN (SELECT hash FROM coordinates_daily ${this.createFilter({
                      target,
                      period,
                      extra: [sql`coordinate = ${schemaCoordinate}`],
                    })})`,
                  ]
                : [],
            },
          )}`,
          queryId: 'count_operations_daily',
          timeout: 10_000,
        },
        hourly: {
          query: sql`SELECT sum(total) as total, sum(total_ok) as totalOk FROM operations_hourly ${this.createFilter(
            {
              target,
              period,
              operations,
              clients,
              extra: schemaCoordinate
                ? [
                    sql`hash IN (SELECT hash FROM coordinates_daily ${this.createFilter({
                      target,
                      period,
                      extra: [sql`coordinate = ${schemaCoordinate}`],
                    })})`,
                  ]
                : [],
            },
          )}`,
          queryId: 'count_operations_hourly',
          timeout: 15_000,
        },
        minutely: {
          query: sql`SELECT sum(total) as total, sum(total_ok) as totalOk FROM operations_minutely ${this.createFilter(
            {
              target,
              period,
              operations,
              clients,
              extra: schemaCoordinate
                ? [
                    sql`hash IN (SELECT hash FROM coordinates_daily ${this.createFilter({
                      target,
                      period,
                      extra: [sql`coordinate = ${schemaCoordinate}`],
                    })})`,
                  ]
                : [],
            },
          )}`,
          queryId: 'count_operations_regular',
          timeout: 30_000,
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
    const query = this.pickQueryByPeriod(
      {
        daily: {
          query: sql`
            SELECT count(distinct hash) as total
            FROM operations_daily
            ${this.createFilter({
              target,
              period,
              operations,
              clients,
            })}
          `,
          queryId: 'count_unique_documents_daily',
          timeout: 10_000,
        },
        hourly: {
          query: sql`
            SELECT count(distinct hash) as total
            FROM operations_hourly
            ${this.createFilter({
              target,
              period,
              operations,
              clients,
            })}
          `,
          queryId: 'count_unique_documents_hourly',
          timeout: 15_000,
        },
        minutely: {
          query: sql`
            SELECT count(distinct hash) as total
            FROM operations_minutely
            ${this.createFilter({
              target,
              period,
              operations,
              clients,
            })}
          `,
          queryId: 'count_unique_documents',
          timeout: 15_000,
        },
      },
      period,
    );

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
    const query = this.pickQueryByPeriod(
      {
        daily: {
          query: sql`
            SELECT sum(total) as total, sum(total_ok) as totalOk, hash 
            FROM operations_daily
            ${this.createFilter({
              target,
              period,
              operations,
              clients,
              extra: schemaCoordinate
                ? [
                    sql`hash IN (SELECT hash FROM coordinates_daily ${this.createFilter({
                      target,
                      period,
                      extra: [sql`coordinate = ${schemaCoordinate}`],
                    })})`,
                  ]
                : [],
            })}
            GROUP BY hash
          `,
          queryId: 'read_unique_documents_daily',
          timeout: 10_000,
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
              clients,
              extra: schemaCoordinate
                ? [
                    sql`hash IN (SELECT hash FROM coordinates_daily ${this.createFilter({
                      target,
                      period,
                      extra: [sql`coordinate = ${schemaCoordinate}`],
                    })})`,
                  ]
                : [],
            })}
            GROUP BY hash
          `,
          queryId: 'read_unique_documents_hourly',
          timeout: 15_000,
        },
        minutely: {
          query: sql`
            SELECT sum(total) as total, sum(total_ok) as totalOk, hash
            FROM operations_minutely
            ${this.createFilter({
              target,
              period,
              operations,
              clients,
              extra: schemaCoordinate
                ? [
                    sql`hash IN (SELECT hash FROM coordinates_daily ${this.createFilter({
                      target,
                      period,
                      extra: [sql`coordinate = ${schemaCoordinate}`],
                    })})`,
                  ]
                : [],
            })}
            GROUP BY hash
          `,
          queryId: 'read_unique_documents',
          timeout: 15_000,
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
                            sql`hash IN (SELECT hash FROM coordinates_daily ${this.createFilter({
                              target,
                              period,
                              extra: [sql`coordinate = ${schemaCoordinate}`],
                            })})`,
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
        queryId: 'operations_registry',
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

  async readOperationBody({ target, hash }: { target: string; hash: string }) {
    const result = await this.clickHouse.query<{
      body: string;
    }>({
      query: sql`
        SELECT 
          body
        FROM operation_collection_body
          ${this.createFilter({
            target,
            extra: [sql`hash = ${hash}`],
          })}
        LIMIT 1
        SETTINGS allow_asynchronous_read_from_io_pool_for_merge_tree = 1
      `,
      queryId: 'read_body',
      timeout: 10_000,
    });

    return result.data.length ? result.data[0].body : null;
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
    }>({
      query: sql`
        SELECT 
          coordinate
        FROM coordinates_daily
          ${this.createFilter({
            target,
            period,
          })}
        WHERE coordinate NOT ILIKE '%.__typename'
        GROUP BY coordinate
      `,
      queryId: 'reported_schema_coordinates',
      timeout: 10_000,
    });

    return new Set(result.data.map(row => row.coordinate));
  }

  async countUniqueClients({
    target,
    period,
    operations,
    schemaCoordinate,
  }: {
    target: string;
    period: DateRange;
    operations?: readonly string[];
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
      this.pickQueryByPeriod(
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
                extra: schemaCoordinate
                  ? [
                      sql`hash IN (SELECT hash FROM coordinates_daily ${this.createFilter({
                        target,
                        period,
                        extra: [sql`coordinate = ${schemaCoordinate}`],
                      })})`,
                    ]
                  : [],
              })}
              GROUP BY client_name, client_version
              ORDER BY total DESC
            `,
            queryId: 'count_clients_daily',
            timeout: 10_000,
          },
          hourly: {
            query: sql`
              SELECT 
                sum(total) as total,
                client_name,
                client_version
              FROM operations_hourly
              ${this.createFilter({
                target,
                period,
                operations,
                extra: schemaCoordinate
                  ? [
                      sql`hash IN (SELECT hash FROM coordinates_daily ${this.createFilter({
                        target,
                        period,
                        extra: [sql`coordinate = ${schemaCoordinate}`],
                      })})`,
                    ]
                  : [],
              })}
              GROUP BY client_name, client_version
              ORDER BY total DESC
            `,
            queryId: 'count_clients_hourly',
            timeout: 10_000,
          },
          minutely: {
            query: sql`
              SELECT 
                sum(total) as total,
                client_name,
                client_version
              FROM operations_minutely
              ${this.createFilter({
                target,
                period,
                operations,
                extra: schemaCoordinate
                  ? [
                      sql`hash IN (SELECT hash FROM coordinates_daily ${this.createFilter({
                        target,
                        period,
                        extra: [sql`coordinate = ${schemaCoordinate}`],
                      })})`,
                    ]
                  : [],
              })}
              GROUP BY client_name, client_version
              ORDER BY total DESC
            `,
            queryId: 'count_clients_regular',
            timeout: 10_000,
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
      this.pickQueryByPeriod(
        {
          daily: {
            query: sql`
              SELECT 
                sum(total) as total,
                client_version
              FROM clients_daily
              ${this.createFilter({
                target,
                period,
                clients: clientName === 'unknown' ? [clientName, ''] : [clientName],
              })}
              GROUP BY client_version
              ORDER BY total DESC
              LIMIT ${sql.raw(limit.toString())}
            `,
            queryId: 'read_client_versions_daily',
            timeout: 10_000,
          },
          hourly: {
            query: sql`
              SELECT 
                sum(total) as total,
                client_version
              FROM operations_hourly
              ${this.createFilter({
                target,
                period,
                clients: clientName === 'unknown' ? [clientName, ''] : [clientName],
              })}
              GROUP BY client_version
              ORDER BY total DESC
              LIMIT ${sql.raw(limit.toString())}
            `,
            queryId: 'read_client_versions_hourly',
            timeout: 10_000,
          },
          minutely: {
            query: sql`
              SELECT 
                sum(total) as total,
                client_version
              FROM operations_minutely
              ${this.createFilter({
                target,
                period,
                clients: clientName === 'unknown' ? [clientName, ''] : [clientName],
              })}
              GROUP BY client_version
              ORDER BY total DESC
              LIMIT ${sql.raw(limit.toString())}
            `,
            queryId: 'read_client_versions_regular',
            timeout: 10_000,
          },
        },
        period,
      ),
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
      this.pickQueryByPeriod(
        {
          daily: {
            query: sql`
              SELECT 
                count(distinct client_version) as total
              FROM clients_daily
              ${this.createFilter({
                target,
                period,
                clients: clientName === 'unknown' ? [clientName, ''] : [clientName],
              })}
            `,
            queryId: 'count_client_versions_daily',
            timeout: 10_000,
          },
          hourly: {
            query: sql`
              SELECT 
                count(distinct client_version) as total
              FROM operations_hourly
              ${this.createFilter({
                target,
                period,
                clients: clientName === 'unknown' ? [clientName, ''] : [clientName],
              })}
            `,
            queryId: 'count_client_versions_hourly',
            timeout: 10_000,
          },
          minutely: {
            query: sql`
              SELECT 
                count(distinct client_version) as total
              FROM operations_minutely
              ${this.createFilter({
                target,
                period,
                clients: clientName === 'unknown' ? [clientName, ''] : [clientName],
              })}
            `,
            queryId: 'count_client_versions_regular',
            timeout: 10_000,
          },
        },
        period,
      ),
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
      typeName => sql`( cd.coordinate = ${typeName} OR cd.coordinate LIKE ${typeName + '.%'} )`,
    );

    const result = await this.clickHouse.query<{
      total: string;
      hash: string;
      name: string;
      coordinate: string;
    }>({
      queryId: 'get_top_operations_for_types',
      query: sql`
        WITH coordinates as (
          SELECT cd.total, cd.hash, cd.coordinate
          FROM (
            SELECT
              sum(cdi.total) as total, cdi.hash as hash, cdi.coordinate as coordinate
            FROM coordinates_daily as cdi
              ${this.createFilter({
                target: args.targetId,
                period: args.period,
                extra: [sql`cdi.coordinate NOT LIKE '%.%.%'`],
                namespace: 'cdi',
              })}
            GROUP BY cdi.hash, cdi.coordinate ORDER by total DESC, cdi.hash ASC LIMIT ${sql.raw(
              String(args.limit),
            )} by cdi.coordinate
          ) as cd
          WHERE ${sql.join(ORs, ' OR ')}
        )
        SELECT total, hash, coordinate, ocd.name
        FROM coordinates as c LEFT JOIN (
            SELECT ocd.name, ocd.hash
            FROM operation_collection_details as ocd
            WHERE ocd.target = ${args.targetId} AND hash IN (SELECT hash FROM coordinates)
            LIMIT 1 BY ocd.hash
        ) as ocd ON ocd.hash = c.hash
      `,
      timeout: 15_000,
    });

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

    const dbResult = await this.clickHouse.query({
      queryId: 'get_hashes_for_schema_coordinates',
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
      query: sql`
        SELECT
          co.coordinate AS coordinate,
          groupUniqArrayArray(cl.client_names) AS client_names
        FROM
        (
          SELECT
            co.coordinate,
            co.hash
          FROM coordinates_daily AS co
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
            FROM clients_daily AS cl
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
    });

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
      aggregationResultMap.set(
        key,
        this.clickHouse
          .query<{
            date: number;
            target: string;
            total: number;
          }>(
            this.pickQueryByPeriod(
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
                      sum(total) as total,
                      target
                    FROM operations_daily
                    ${this.createFilter({ target: targets, period })}
                    GROUP BY date, target
                    ORDER BY date
                  `,
                  queryId: 'targets_count_over_time_daily',
                  timeout: 15_000,
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
                      sum(total) as total,
                      target
                    FROM operations_hourly
                    ${this.createFilter({ target: targets, period })}
                    GROUP BY date, target
                    ORDER BY date
                  `,
                  queryId: 'targets_count_over_time_hourly',
                  timeout: 15_000,
                },
                minutely: {
                  query: sql`
                    SELECT 
                      multiply(
                        toUnixTimestamp(
                          toStartOfInterval(timestamp, INTERVAL ${this.clickHouse.translateWindow(
                            calculateTimeWindow({ period, resolution }),
                          )}, 'UTC'),
                        'UTC'),
                      1000) as date,
                      sum(total) as total,
                      target
                    FROM operations_minutely
                    ${this.createFilter({ target: targets, period })}
                    GROUP BY date, target
                    ORDER BY date
                  `,
                  queryId: 'targets_count_over_time_regular',
                  timeout: 15_000,
                },
              },
              period,
              resolution,
            ),
          )
          .then(result => result.data),
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
      this.pickQueryByPeriod(
        {
          daily: {
            query: sql`
              SELECT 
                quantilesMerge(0.75, 0.90, 0.95, 0.99)(duration_quantiles) as percentiles
              FROM operations_daily
              ${this.createFilter({ target, period, operations, clients })}
            `,
            queryId: 'general_duration_percentiles_daily',
            timeout: 15_000,
          },
          hourly: {
            query: sql`
              SELECT 
                quantilesMerge(0.75, 0.90, 0.95, 0.99)(duration_quantiles) as percentiles
              FROM operations_hourly
              ${this.createFilter({ target, period, operations, clients })}
            `,
            queryId: 'general_duration_percentiles_hourly',
            timeout: 15_000,
          },
          minutely: {
            query: sql`
              SELECT 
                quantilesMerge(0.75, 0.90, 0.95, 0.99)(duration_quantiles) as percentiles
              FROM operations_minutely
              ${this.createFilter({ target, period, operations, clients })}
            `,
            queryId: 'general_duration_percentiles_regular',
            timeout: 15_000,
          },
        },
        period,
      ),
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
      this.pickQueryByPeriod(
        {
          daily: {
            query: sql`
              SELECT 
                hash,
                quantilesMerge(0.75, 0.90, 0.95, 0.99)(duration_quantiles) as percentiles
              FROM operations_daily
              ${this.createFilter({
                target,
                period,
                operations,
                clients,
                extra: schemaCoordinate
                  ? [
                      sql`hash IN (SELECT hash FROM coordinates_daily ${this.createFilter({
                        target,
                        period,
                        extra: [sql`coordinate = ${schemaCoordinate}`],
                      })})`,
                    ]
                  : [],
              })}
              GROUP BY hash
            `,
            queryId: 'duration_percentiles_daily',
            timeout: 15_000,
          },
          hourly: {
            query: sql`
              SELECT 
                hash,
                quantilesMerge(0.75, 0.90, 0.95, 0.99)(duration_quantiles) as percentiles
              FROM operations_hourly
              ${this.createFilter({
                target,
                period,
                operations,
                clients,
                extra: schemaCoordinate
                  ? [
                      sql`hash IN (SELECT hash FROM coordinates_daily ${this.createFilter({
                        target,
                        period,
                        extra: [sql`coordinate = ${schemaCoordinate}`],
                      })})`,
                    ]
                  : [],
              })}
              GROUP BY hash
            `,
            queryId: 'duration_percentiles_hourly',
            timeout: 15_000,
          },
          minutely: {
            query: sql`
              SELECT 
                hash,
                quantilesMerge(0.75, 0.90, 0.95, 0.99)(duration_quantiles) as percentiles
              FROM operations_minutely
              ${this.createFilter({
                target,
                period,
                operations,
                clients,
                extra: schemaCoordinate
                  ? [
                      sql`hash IN (SELECT hash FROM coordinates_daily ${this.createFilter({
                        target,
                        period,
                        extra: [sql`coordinate = ${schemaCoordinate}`],
                      })})`,
                    ]
                  : [],
              })}
              GROUP BY hash
            `,
            queryId: 'duration_percentiles_regular',
            timeout: 15_000,
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
    const createSQLQuery = (tableName: string, isAggregation: boolean) => {
      const startDateTimeFormatted = formatDate(period.from);
      const endDateTimeFormatted = formatDate(period.to);
      const interval = calculateTimeWindow({ period, resolution });
      const intervalUnit =
        interval.unit === 'd' ? 'DAY' : interval.unit === 'h' ? 'HOUR' : 'MINUTE';

      // TODO: remove this once we shift to the new table structure (PR #2712)
      const quantiles = isAggregation
        ? 'quantilesMerge(0.75, 0.90, 0.95, 0.99)(duration_quantiles)'
        : 'quantiles(0.75, 0.90, 0.95, 0.99)(duration)';
      const total = isAggregation ? 'sum(total)' : 'count(*)';
      const totalOk = isAggregation ? 'sum(total_ok)' : 'sum(ok)';

      return sql`
        WITH
          toDateTime(${startDateTimeFormatted}, 'UTC') as start_date_time,
          toDateTime(${endDateTimeFormatted}, 'UTC') as end_date_time,
          ${intervalUnit} as interval_unit,
          toUInt16(${String(interval.value)}) as interval_value
        SELECT
          multiply(toUnixTimestamp(date, 'UTC'), 1000) as date,
          percentiles,
          total,
          totalOk
        FROM (
          SELECT
            date_add(
                ${sql.raw(intervalUnit)},
                ceil(
                  date_diff(interval_unit, start_date_time, timestamp, 'UTC') / interval_value
                ) as UInt16 * interval_value,
                start_date_time
            ) as date,
            ${sql.raw(quantiles)} as percentiles,
            ${sql.raw(total)} as total,
            ${sql.raw(totalOk)} as totalOk
          FROM ${sql.raw(tableName)}
          ${this.createFilter({
            target,
            period,
            operations,
            clients,
            extra: schemaCoordinate
              ? [
                  sql`hash IN (SELECT hash FROM coordinates_daily ${this.createFilter({
                    target,
                    period,
                    extra: [sql`coordinate = ${schemaCoordinate}`],
                  })})`,
                ]
              : [],
          })}
          GROUP BY date
          ORDER BY date
          WITH FILL
            FROM toDateTime(${startDateTimeFormatted}, 'UTC')
            TO toDateTime(${endDateTimeFormatted}, 'UTC')
            STEP INTERVAL ${this.clickHouse.translateWindow(interval)}
        )
      `;
    };

    const query = this.pickQueryByPeriod(
      {
        daily: {
          query: createSQLQuery('operations_daily', true),
          queryId: 'duration_and_count_over_time_daily',
          timeout: 15_000,
        },
        hourly: {
          query: createSQLQuery('operations_hourly', true),
          queryId: 'duration_and_count_over_time_hourly',
          timeout: 15_000,
        },
        minutely: {
          query: createSQLQuery('operations_minutely', true),
          queryId: 'duration_and_count_over_time_regular',
          timeout: 15_000,
        },
      },
      period,
      resolution,
    );

    // multiply by 1000 to convert to milliseconds
    const result = await this.clickHouse.query<{
      date: number;
      total: number;
      totalOk: number;
      percentiles: [number, number, number, number];
    }>(query);

    return result.data.map(row => {
      return {
        date: ensureNumber(row.date) as any,
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
    const result = await this.clickHouse.query<{
      total: string;
      target: string;
    }>({
      query: sql`
        SELECT
          sum(total) as total,
          target
        FROM operations_daily
        PREWHERE
          timestamp >= toDateTime(${formatDate(period.from)}, 'UTC')
          AND
          timestamp <= toDateTime(${formatDate(period.to)}, 'UTC')
        GROUP BY target`,
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
    const resolution = days <= 1 ? 60 : days;

    const createSQL = (tableName: string) => sql`
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
      FROM ${sql.raw(tableName)}
      PREWHERE 
        timestamp >= toDateTime(${formatDate(period.from)}, 'UTC')
        AND
        timestamp <= toDateTime(${formatDate(period.to)}, 'UTC')
      GROUP BY date
      ORDER BY date
    `;

    const result = await this.clickHouse.query<{
      date: number;
      total: string;
    }>(
      this.pickQueryByPeriod(
        {
          daily: {
            query: createSQL('operations_daily'),
            queryId: 'admin_operations_per_target_daily',
            timeout: 15_000,
          },
          hourly: {
            query: createSQL('operations_hourly'),
            queryId: 'admin_operations_per_target_hourly',
            timeout: 15_000,
          },
          minutely: {
            query: createSQL('operations_minutely'),
            queryId: 'admin_operations_per_target_minutely',
            timeout: 15_000,
          },
        },
        period,
        resolution,
      ),
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
