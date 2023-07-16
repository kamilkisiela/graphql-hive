/* eslint-disable import/first */
/* eslint-disable import/no-extraneous-dependencies */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import pgpFactory from 'pg-promise';
import { createPool, sql } from 'slonik';
import type * as DbTypes from '../../../services/storage/src/db/types';
import { createConnectionString } from '../../src/connection-string';
import { runPGMigrations } from '../../src/run-pg-migrations'

export { DbTypes };

const __dirname = dirname(fileURLToPath(import.meta.url));

config({
  path: resolve(__dirname, '../../.env'),
});

import { env } from '../../src/environment';

export async function initMigrationTestingEnvironment() {
  const pgp = pgpFactory();
  const db = pgp(
    createConnectionString({
      ...env.postgres,
      db: 'postgres',
    }),
  );

  const dbName = 'migration_test_' + Date.now();
  await db.query(`CREATE DATABASE ${dbName};`);

  const slonik = await createPool(
    createConnectionString({
      ...env.postgres,
      db: dbName,
    }),
  );

  const actionsDirectory = resolve(__dirname + '/../../src/actions/');
  console.log('actionsDirectory', actionsDirectory);



  return {
    db: slonik,
    async runTo(name: string) {
      await runPGMigrations({ slonik, runTo: name });
    },
    seed: {
      async user() {
        return await slonik.one<DbTypes.users>(
          sql`INSERT INTO public.users (email, display_name, full_name, supertoken_user_id) VALUES ('test@mail.com', 'test1' , 'test1', '1') RETURNING *;`,
        );
      },
    },
    async complete() {
      await runPGMigrations({ slonik });
    },
    async done(deleteDb = true) {
      deleteDb ?? (await db.query(`DROP DATABASE ${dbName};`));
      await db.$pool.end().catch();
    },
  };
}
