#!/usr/bin/env node
import Redlock from 'redlock';
import { createConnectionStringProvider, createPostgresDatabasePool } from '@hive/postgres';
import { createRedisClient, generateRdsIamAuthToken, registryLockId } from '@hive/service-common';
import { schemaCoordinateStatusMigration } from './actions/2024.07.23T09.36.00.schema-cleanup-tracker';
import { migrateClickHouse } from './clickhouse';
import { env } from './environment';
import { runPGMigrations } from './run-pg-migrations';
import { updateRetention } from './scripts/update-retention';

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

const slonik = await createPostgresDatabasePool({
  connectionParameters: createConnectionStringProvider(env.postgres, rdsIamTokenGenerator),
  // 10 minute timeout per statement
  statementTimeout: 10 * 60 * 1000,
});

const logger = {
  level: 'info',
  silent() {},
  child() {
    return logger;
  },
  debug: console.debug,
  error: console.error,
  fatal: console.error,
  info: console.info,
  trace: console.debug,
  warn: console.warn,
};
// This is used by production build of this package.
// We are building a "cli" out of the package, so we need a workaround to pass the command to run.

// This is only used for Hive Console Cloud to perform a long running migration.
// eslint-disable-next-line no-process-env
if (process.env.SCHEMA_COORDINATE_STATUS_MIGRATION === '1') {
  try {
    console.log('Running the SCHEMA_COORDINATE_STATUS_MIGRATION');
    await schemaCoordinateStatusMigration(slonik);
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

try {
  console.log('Running the UP migrations');
  const redis = await createRedisClient(env.redis, { logger });
  const redlock = new Redlock([redis]);

  try {
    await runPGMigrations({
      slonik,
      withRegistryLock(targetId, action) {
        return redlock.using(
          [registryLockId(targetId)],
          10_000,
          { retryCount: -1, retryDelay: 1_000 },
          action,
        );
      },
    });
  } finally {
    await redis.quit();
  }
  if (env.clickhouse) {
    await migrateClickHouse(
      env.isClickHouseMigrator,
      env.isHiveCloud,
      env.hiveCloudEnvironment,
      env.clickhouse,
    );
  }

  // Automatically apply retention if any retention setting is configured
  if (
    // eslint-disable-next-line no-process-env
    process.env.CLICKHOUSE_TTL_TABLES ||
    // eslint-disable-next-line no-process-env
    process.env.CLICKHOUSE_TTL_DAILY_MV_TABLES ||
    // eslint-disable-next-line no-process-env
    process.env.CLICKHOUSE_TTL_HOURLY_MV_TABLES ||
    // eslint-disable-next-line no-process-env
    process.env.CLICKHOUSE_TTL_MINUTELY_MV_TABLES
  ) {
    console.log('Applying clickhouse retention settings...');
    try {
      await updateRetention();
    } catch (error) {
      console.error('Failed to update retention (non-fatal):', error);
    }
  }

  process.exit(0);
} catch (error) {
  console.error(error);
  process.exit(1);
}
