/* eslint-disable import/first */
 
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import pgpFactory from 'pg-promise';
import { createPool, sql } from 'slonik';
import type * as DbTypes from '../../../services/storage/src/db/types';
import { createConnectionString } from '../../src/connection-string';
import { runPGMigrations } from '../../src/run-pg-migrations'

export { type DbTypes }

const __dirname = dirname(fileURLToPath(import.meta.url));

config({
  path: resolve(__dirname, '../../.env'),
});

import { env } from '../../src/environment';

export async function initMigrationTestingEnvironment() {
  const pgp = pgpFactory();
  const db = pgp(createConnectionString({
    ...env.postgres,
    db: 'postgres',
  }));
  
  const dbName = 'migration_test_' + Date.now() + Math.random().toString(16).substring(2);
  console.log('db name:', dbName)
  await db.query(`CREATE DATABASE ${dbName};`);
  
  const connectionString = createConnectionString({
    ...env.postgres,
    db: dbName,
  });
  const slonik = await createPool(
    connectionString
  );

  const actionsDirectory = resolve(__dirname + '/../../src/actions/');
  console.log('actionsDirectory', actionsDirectory);

  let superTokenUserIdCounter = 1;

  return {
    connectionString,
    db: slonik,
    async runTo(name: string) {
      await runPGMigrations({ slonik, runTo: name });
    },
    seed: {
      async user({
        user
      }: {
        user: {
          name: string;
          email: string;
        }
      }) {
        return await slonik.one<DbTypes.users>(
          sql`INSERT INTO public.users (email, display_name, full_name, supertoken_user_id) VALUES (${user.email}, ${user.name} , ${user.name}, ${superTokenUserIdCounter++}) RETURNING *;`,
        );
      },
      async organization({
        organization,
        user,
      }: {
        organization: {
          name: string;
        },
        user: {
          id: string;
        }
      }) {
        return await slonik.one<DbTypes.organizations>(
          sql`INSERT INTO public.organizations (clean_id, name, user_id) VALUES (${organization.name}, ${organization.name}, ${user.id}) RETURNING *;`,
        );
      },
      async project({
        project,
        organization,
      }: {
        project: {
          name: string;
          type: string;
        },
        organization: {
          id: string;
        }
      }) {
        return await slonik.one<DbTypes.projects>(
          sql`INSERT INTO public.projects (clean_id, name, type, org_id) VALUES (${project.name}, ${project.name}, ${project.type}, ${organization.id}) RETURNING *;`,
        )
      },
      async target({
        project,
        target,
      }: {
        project: {
          id: string;
        },
        target: {
          name: string;
        }
      }) {
        return await slonik.one<DbTypes.targets>(
          sql`INSERT INTO public.targets (clean_id, name, project_id) VALUES (${target.name}, ${target.name}, ${project.id}) RETURNING *;`,
        )
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
