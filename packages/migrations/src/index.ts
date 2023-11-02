#!/usr/bin/env node
import { createPool } from 'slonik';
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

console.log('Running the UP migrations');

try {
  await runPGMigrations({ slonik });
  if (env.clickhouse) {
    await migrateClickHouse(env.isClickHouseMigrator, env.clickhouse);
  }
  process.exit(0);
} catch (error) {
  console.error(error);
  process.exit(1);
}
