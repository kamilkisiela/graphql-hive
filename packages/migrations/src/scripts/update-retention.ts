#!/usr/bin/env node
import got, { HTTPError } from 'got';
import { z } from 'zod';
import { createConnectionStringProvider, createPostgresDatabasePool, psql } from '@hive/postgres';
import { generateRdsIamAuthToken } from '@hive/service-common';
import { env } from '../environment';

interface QueryResponse<T> {
  data: readonly T[];
  rows: number;
  statistics: {
    elapsed: number;
  };
}

interface RetentionValue {
  days: number;
  interval: string;
  displayValue: string;
}

const SystemTablesModel = z.array(
  z.object({
    name: z.string(),
    uuid: z.string(),
    engine_full: z.string(),
  }),
);

function parseRetentionValue(value: string): RetentionValue {
  const trimmed = value.trim();

  const numericValue = parseInt(trimmed, 10);
  if (!isNaN(numericValue) && trimmed === numericValue.toString()) {
    if (numericValue < 1) {
      throw new Error('Retention value must be at least 1 day');
    }
    return {
      days: numericValue,
      interval: `INTERVAL ${numericValue} DAY`,
      displayValue: `${numericValue} days`,
    };
  }

  const intervalMatch = trimmed.match(/^(\d+)\s+(YEAR|MONTH|WEEK|DAY|HOUR|MINUTE|SECOND)S?$/i);
  if (!intervalMatch) {
    throw new Error(
      `Invalid retention value: "${value}". Must be either a number (days) or ClickHouse interval syntax (e.g., '1 YEAR', '30 DAY', '24 HOUR').`,
    );
  }

  const amount = parseInt(intervalMatch[1], 10);
  const unit = intervalMatch[2].toUpperCase().replace(/S$/, ''); // Remove trailing 'S' if present

  if (amount < 1) {
    throw new Error('Retention interval amount must be at least 1');
  }

  // Convert to approximate days for PostgreSQL
  const daysMap: Record<string, number> = {
    YEAR: 365,
    MONTH: 30,
    WEEK: 7,
    DAY: 1,
    HOUR: 1 / 24,
    MINUTE: 1 / (24 * 60),
    SECOND: 1 / (24 * 60 * 60),
  };

  const days = Math.max(1, Math.floor(amount * daysMap[unit]));

  return {
    days,
    interval: `INTERVAL ${amount} ${unit}`,
    displayValue: `${amount} ${unit}`,
  };
}

export async function updateRetention() {
  let clickhouseRetention: RetentionValue | undefined;
  let mvRetentionDaily: RetentionValue | undefined;
  let mvRetentionHourly: RetentionValue | undefined;
  let mvRetentionMinutely: RetentionValue | undefined;

  try {
    if (process.env.CLICKHOUSE_TTL_TABLES) {
      clickhouseRetention = parseRetentionValue(process.env.CLICKHOUSE_TTL_TABLES);
    }
    if (process.env.CLICKHOUSE_TTL_DAILY_MV_TABLES) {
      mvRetentionDaily = parseRetentionValue(process.env.CLICKHOUSE_TTL_DAILY_MV_TABLES);
    }
    if (process.env.CLICKHOUSE_TTL_HOURLY_MV_TABLES) {
      mvRetentionHourly = parseRetentionValue(process.env.CLICKHOUSE_TTL_HOURLY_MV_TABLES);
    }
    if (process.env.CLICKHOUSE_TTL_MINUTELY_MV_TABLES) {
      mvRetentionMinutely = parseRetentionValue(process.env.CLICKHOUSE_TTL_MINUTELY_MV_TABLES);
    }
  } catch (error) {
    console.error('Failed to parse retention values:', (error as Error).message);
    process.exit(1);
  }

  if (!clickhouseRetention && !mvRetentionDaily && !mvRetentionHourly && !mvRetentionMinutely) {
    return;
  }

  const allRetentions = [
    clickhouseRetention,
    mvRetentionDaily,
    mvRetentionHourly,
    mvRetentionMinutely,
  ].filter((r): r is RetentionValue => r !== undefined);

  const maxRetention = allRetentions.reduce((max, current) =>
    current.days > max.days ? current : max,
  );

  await updatePostgreSQLRetention(maxRetention);

  if (env.clickhouse) {
    if (clickhouseRetention) {
      await updateClickHouseMgTableTTL(clickhouseRetention);
    }
    if (mvRetentionDaily || mvRetentionHourly || mvRetentionMinutely) {
      await updateClickHouseMVTableTTL(mvRetentionDaily, mvRetentionHourly, mvRetentionMinutely);
    }
  } else {
    console.log('ClickHouse not configured, skipping ClickHouse TTL updates');
  }
}

function createClickHouseHelpers(endpoint: string, username: string, password: string) {
  function exec(queryString: string, settings?: Record<string, string>) {
    return got
      .post(endpoint, {
        body: queryString,
        searchParams: {
          default_format: 'JSON',
          output_format_json_quote_64bit_integers: '1',
          wait_end_of_query: '1',
          ...settings,
        },
        headers: {
          Accept: 'text/plain',
        },
        username,
        password,
      })
      .catch(error => {
        if (error instanceof HTTPError && error.response.body) {
          console.error(error.response.body);
        }
        return Promise.reject(error);
      });
  }

  function query(queryString: string) {
    return got
      .post<QueryResponse<unknown>>(endpoint, {
        body: queryString,
        searchParams: {
          default_format: 'JSON',
          output_format_json_quote_64bit_integers: '1',
          wait_end_of_query: '1',
        },
        headers: {
          'Accept-Encoding': 'gzip',
          Accept: 'application/json',
        },
        decompress: true,
        username,
        password,
        responseType: 'json',
      })
      .catch(error => {
        if (error instanceof HTTPError && error.response.body) {
          console.error(error.response.body);
        }
        return Promise.reject(error);
      })
      .then(r => r.body);
  }

  return { exec, query };
}

async function updatePostgreSQLRetention(retention: RetentionValue) {
  const rdsIamTokenGenerator = env.postgres.awsIamAuthEnabled
    ? () =>
        generateRdsIamAuthToken(
          {
            region: env.postgres.awsRegion ?? '',
            hostname: env.postgres.host,
            port: env.postgres.port,
            username: env.postgres.user,
          },
          console,
        )
    : undefined;

  const connectionStringProvider = createConnectionStringProvider(
    env.postgres,
    rdsIamTokenGenerator,
  );

  const pool = await createPostgresDatabasePool({
    connectionParameters: connectionStringProvider,
    statementTimeout: 10 * 60 * 1000, // 10 minute timeout
  });

  try {
    const result = await pool.any(psql`
      UPDATE organizations
      SET limit_retention_days = ${retention.days}
    `);

    const updatedCount = result.length;
    console.log(
      `Updated ${updatedCount} organization(s) (limit_retention_days: ${retention.days})`,
    );
  } catch (error) {
    console.error('Failed to update PostgreSQL:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

async function updateClickHouseMgTableTTL(retention: RetentionValue) {
  if (!env.clickhouse) {
    console.error('ClickHouse connection not configured');
    return;
  }

  const clickhouse = env.clickhouse;
  const endpoint = `${clickhouse.protocol}://${clickhouse.host}:${clickhouse.port}`;
  const { exec, query } = createClickHouseHelpers(
    endpoint,
    clickhouse.username,
    clickhouse.password,
  );

  try {
    const mgTables = [
      { name: 'operations', ttlColumn: 'expires_at', cast: false },
      { name: 'operation_collection', ttlColumn: 'expires_at', cast: false },
      { name: 'subscription_operations', ttlColumn: 'expires_at', cast: false },
      { name: 'audit_logs', ttlColumn: 'timestamp', cast: false },
      { name: 'otel_traces', ttlColumn: 'Timestamp', cast: true }, // DateTime64 needs casting
      { name: 'otel_traces_trace_id_ts', ttlColumn: 'Start', cast: true }, // DateTime64 needs casting
      { name: 'otel_traces_normalized', ttlColumn: 'timestamp', cast: false },
      { name: 'otel_subgraph_spans', ttlColumn: 'timestamp', cast: false },
      { name: 'daily_overview', ttlColumn: 'date', cast: false },
      { name: 'monthly_overview', ttlColumn: 'date', cast: false },
      { name: 'app_deployment_usage', ttlColumn: 'last_request', cast: false },
    ];

    let updatedCount = 0;
    const skipped: string[] = [];

    for (const { name: tableName, ttlColumn, cast } of mgTables) {
      try {
        // Check if table exists
        const tableInfo = await query(`
          SELECT name, engine_full
          FROM system.tables
          WHERE database = 'default' AND name = '${tableName}'
          LIMIT 1
        `).then((r: QueryResponse<unknown>) => r.data);

        if (tableInfo.length === 0) {
          skipped.push(tableName);
          continue;
        }

        const ttlExpression = cast ? `toDateTime(${ttlColumn})` : ttlColumn;

        await exec(
          `ALTER TABLE default."${tableName}" MODIFY TTL ${ttlExpression} + ${retention.interval}`,
        );
        updatedCount++;
      } catch (error) {
        console.error(`Failed to update ${tableName}:`, error);
      }
    }

    if (updatedCount > 0) {
      console.log(`Updated ${updatedCount} mergetree tables (TTL: ${retention.displayValue})`);
    }
    if (skipped.length > 0) {
      console.log(`Skipped non-existent tables: ${skipped.join(', ')}`);
    }
  } catch (error) {
    console.error('Error updating ClickHouse table TTL:', error);
    throw error;
  }
}

async function updateClickHouseMVTableTTL(
  dailyRetention: RetentionValue | undefined,
  hourlyRetention: RetentionValue | undefined,
  minutelyRetention: RetentionValue | undefined,
) {
  if (!env.clickhouse) {
    console.error('ClickHouse connection not configured');
    return;
  }

  const clickhouse = env.clickhouse;
  const endpoint = `${clickhouse.protocol}://${clickhouse.host}:${clickhouse.port}`;
  const { exec, query } = createClickHouseHelpers(
    endpoint,
    clickhouse.username,
    clickhouse.password,
  );

  try {
    const settingsResult = await query(
      `SELECT value FROM system.settings WHERE name = 'materialize_ttl_after_modify' AND value = '1'`,
    );

    if (settingsResult.rows === 0) {
      console.warn(
        '  materialize_ttl_after_modify is not enabled. TTL changes may not take effect immediately.',
      );
    }

    const tablesToUpdate = [
      // Daily tables
      'operations_daily',
      'coordinates_daily',
      'clients_daily',
      'subscription_operations_daily',
      'operation_collection_body',
      'operation_collection_details',
      'target_existence',
      'subscription_target_existence',
      // Hourly tables
      'operations_hourly',
      'coordinates_hourly',
      'clients_hourly',
      // Minutely tables
      'operations_minutely',
      'coordinates_minutely',
      'clients_minutely',
    ];

    let dailyUpdated = 0;
    let hourlyUpdated = 0;
    let minutelyUpdated = 0;
    const failed: string[] = [];

    for (const tableName of tablesToUpdate) {
      try {
        // Determine which retention value to use
        let ttlRetention: RetentionValue | undefined;
        if (tableName.includes('minutely')) {
          ttlRetention = minutelyRetention;
        } else if (tableName.includes('hourly')) {
          ttlRetention = hourlyRetention;
        } else {
          ttlRetention = dailyRetention;
        }

        // Skip if retention value is not set
        if (!ttlRetention) {
          continue;
        }

        const tableInfo = await query(`
          SELECT uuid, name, engine_full
          FROM system.tables
          WHERE database = 'default' AND name = '${tableName}'
          LIMIT 1
        `).then((r: QueryResponse<unknown>) => SystemTablesModel.parse(r.data));

        if (tableInfo.length === 0) {
          failed.push(tableName);
          continue;
        }

        const [table] = tableInfo;
        const innerTableName = `.inner_id.${table.uuid}`;

        const innerTableInfo = await query(`
          SELECT name
          FROM system.tables
          WHERE database = 'default' AND name = '${innerTableName}'
          LIMIT 1
        `);

        if (innerTableInfo.rows === 0) {
          failed.push(tableName);
          continue;
        }

        const ttlColumn =
          tableName.includes('target_existence') || tableName.includes('operation_collection')
            ? 'expires_at'
            : 'timestamp';

        await exec(
          `ALTER TABLE "${innerTableName}" MODIFY TTL ${ttlColumn} + ${ttlRetention.interval}`,
        );

        if (tableName.includes('minutely')) {
          minutelyUpdated++;
        } else if (tableName.includes('hourly')) {
          hourlyUpdated++;
        } else {
          dailyUpdated++;
        }
      } catch (error) {
        console.error(`Failed to update ${tableName}:`, error);
        failed.push(tableName);
      }
    }

    if (dailyUpdated > 0 && dailyRetention) {
      console.log(
        `Updated ${dailyUpdated} daily materialized views (TTL: ${dailyRetention.displayValue})`,
      );
    }
    if (hourlyUpdated > 0 && hourlyRetention) {
      console.log(
        `Updated ${hourlyUpdated} hourly materialized views (TTL: ${hourlyRetention.displayValue})`,
      );
    }
    if (minutelyUpdated > 0 && minutelyRetention) {
      console.log(
        `Updated ${minutelyUpdated} minutely materialized views (TTL: ${minutelyRetention.displayValue})`,
      );
    }
    if (failed.length > 0) {
      console.warn(`Failed to update ${failed.length} materialized view(s): ${failed.join(', ')}`);
    }
  } catch (error) {
    console.error('  Error updating ClickHouse TTL:', error);
    throw error;
  }
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  updateRetention().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
