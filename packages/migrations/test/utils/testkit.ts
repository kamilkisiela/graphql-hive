/* eslint-disable import/first */
 
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import pgpFactory from 'pg-promise';
import { createPool, sql } from 'slonik';
import type * as DbTypes from '../../../services/storage/src/db/types';
import { createConnectionString } from '../../src/connection-string';
import { runPGMigrations } from '../../src/run-pg-migrations'

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



  return {
    connectionString,
    db: slonik,
    async runTo(name: string) {
      await runPGMigrations({ slonik, runTo: name });
    },
    seed: {
      async user(user?: {
        email: string;
        display_name: string;
        full_name: string;
        supertoken_user_id?: string;
      }) {
        if (!user) {
          user = {
            email: 'test1@mail.com',
            display_name: 'test1',
            full_name: 'test1',
            supertoken_user_id: '1',
          }
        }

        return await slonik.one<DbTypes.users>(
          sql`INSERT INTO public.users (email, display_name, full_name, supertoken_user_id) VALUES (${user.email}, ${user.display_name} , ${user.full_name}, ${user.supertoken_user_id ?? null}) RETURNING *;`,
        );
      },
      async organization({ user, organization }: {
        user: DbTypes.users;
        organization: {
          name: string;
          cleanId: string;
        }
      }) {
        return await slonik.one<DbTypes.organizations>(
          sql`INSERT INTO public.organizations (clean_id, name, user_id) VALUES (${organization.cleanId}, ${organization.name}, ${user.id}) RETURNING *`,
        );
      },
      async project({ organization, project }: {
        organization: DbTypes.organizations;
        project: {
          name: string;
          cleanId: string;
          type: string;
        }
      }) {
        return await slonik.one<DbTypes.projects>(
          sql`INSERT INTO public.projects (clean_id, name, type, org_id) VALUES (${project.cleanId}, ${project.name}, ${project.type}, ${organization.id}) RETURNING *`,
        );
      },
      async target({ project, target }: {
        project: DbTypes.projects;
        target: {
          name: string;
          cleanId: string;
        }
      }) {
        return await slonik.one<DbTypes.targets>(
          sql`INSERT INTO public.targets (name, clean_id, project_id) VALUES (${target.name}, ${target.cleanId}, ${project.id}) RETURNING *`,
        );
      }
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
