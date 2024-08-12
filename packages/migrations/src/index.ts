#!/usr/bin/env node
import { createPool } from 'slonik';
import { schemaCoordinateStatusMigration } from './actions/2024.07.23T09.36.00.schema-cleanup-tracker';
import { migrateClickHouse } from './clickhouse';
import { createConnectionString } from './connection-string';
import { env } from './environment';
import { runPGMigrations } from './run-pg-migrations';

const slonik = await createPool(createConnectionString(env.postgres), {
  // 10 minute timeout per statement
  statementTimeout: 10 * 60 * 1000,
});

// This is used by production build of this package.
// We are building a "cli" out of the package, so we need a workaround to pass the command to run.

// This is only used for GraphQL Hive Cloud to perform a long running migration.
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
  await runPGMigrations({ slonik });
  if (env.clickhouse) {
    await migrateClickHouse(env.isClickHouseMigrator, env.isHiveCloud, env.clickhouse);
  }
  process.exit(0);
} catch (error) {
  console.error(error);
  process.exit(1);
}
