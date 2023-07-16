#!/usr/bin/env node
import path from 'node:path';
import url from 'node:url';
import { createPool } from 'slonik';
import { migrateClickHouse } from './clickhouse';
import { createConnectionString } from './connection-string';
import { env } from './environment';
import { runPGMigrations } from './run-pg-migrations';

const slonik = await createPool(createConnectionString(env.postgres));
const [, , cmd] = process.argv;

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const actionsDirectory = __dirname + path.sep + 'actions';
console.log('Actions in:', actionsDirectory);

// This is used by production build of this package.
// We are building a "cli" out of the package, so we need a workaround to pass the command to run.

if (env.isMigrator || cmd === 'up') {
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
}
