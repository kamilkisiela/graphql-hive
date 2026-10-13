/* eslint-disable import/first */

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import pgpFactory from 'pg-promise';
import type * as DbTypes from '../../../services/storage/src/db/types';
import { createConnectionString, psql, createPostgresDatabasePool } from '@hive/postgres';
import { runPGMigrations } from '../../src/run-pg-migrations'

export { type DbTypes }

const __dirname = dirname(fileURLToPath(import.meta.url));

config({
  path: resolve(__dirname, '../../.env'),
});

import { env } from '../../src/environment';
import z from 'zod';

const fallbackRegistryLock: <T>(targetId: string, action: () => Promise<T>) => Promise<T> = (_, action) => action()

export async function initMigrationTestingEnvironment(args?: {
  withRegistryLock?: <T>(targetId: string, action: () => Promise<T>) => Promise<T>;
}) {
  const withRegistryLock = args?.withRegistryLock ?? fallbackRegistryLock;
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
  const slonik = await createPostgresDatabasePool({
    connectionParameters:   connectionString
  }
  );

  const actionsDirectory = resolve(__dirname + '/../../src/actions/');
  console.log('actionsDirectory', actionsDirectory);

  let superTokenUserIdCounter = 1;

  return {
    connectionString,
    db: slonik,
    async runTo(name: string) {
      await runPGMigrations({ slonik, runTo: name, withRegistryLock });
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
        return await slonik.one(
          psql`INSERT INTO users (email, display_name, full_name, supertoken_user_id) VALUES (${user.email}, ${user.name} , ${user.name}, ${superTokenUserIdCounter++}) RETURNING *;`,
        ).then(z.object({ id: z.string()}).parse);
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
        return await slonik.one(
          psql`INSERT INTO organizations (clean_id, name, user_id) VALUES (${organization.name}, ${organization.name}, ${user.id}) RETURNING *;`,
        ).then(z.object({ id: z.string()}).parse);
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
        return await slonik.one(
          psql`INSERT INTO projects (clean_id, name, type, org_id) VALUES (${project.name}, ${project.name}, ${project.type}, ${organization.id}) RETURNING *;`,
        ).then(z.object({ id: z.string()}).parse);
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
        return await slonik.one(
          psql`INSERT INTO targets (clean_id, name, project_id) VALUES (${target.name}, ${target.name}, ${project.id}) RETURNING *;`,
        ).then(z.object({ id: z.string()}).parse);
      },
    },
    async complete() {
      await runPGMigrations({ slonik, withRegistryLock });
    },
    async done(deleteDb = true) {
      try {
        await slonik.end();
        if (deleteDb) {
          await db.query(`DROP DATABASE ${dbName};`);
        }
      } finally {
        await db.$pool.end().catch(() => {});
      }
    },
  };
}
