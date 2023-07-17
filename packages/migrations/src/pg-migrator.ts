import {
  sql,
  type DatabasePool,
  type DatabaseTransactionConnection,
  type SqlTaggedTemplate,
  type TaggedTemplateLiteralInvocation,
} from 'slonik';

export type MigrationExecutor = {
  name: string;
  run: (args: {
    connection: DatabaseTransactionConnection;
    sql: SqlTaggedTemplate;
  }) => Promise<void> | TaggedTemplateLiteralInvocation;
};

const seedMigrationsIfNotExists = async (args: { connection: DatabaseTransactionConnection }) => {
  await args.connection.query(sql`
    CREATE TABLE IF NOT EXISTS "public"."migration" (
      "name" text NOT NULL,
      "hash" text NOT NULL,
      "date" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "migration_pkey" PRIMARY KEY (name)
    );
  `);
};

export async function runMigrations(args: {
  slonik: DatabasePool;
  migrations: Array<MigrationExecutor>;
  runTo?: string;
}) {
  console.log('Running PG migrations.');

  await args.slonik.transaction(async connection => {
    await seedMigrationsIfNotExists({ connection });
    for (const migration of args.migrations) {
      const { name } = migration;

      const exists = await connection.maybeOneFirst(sql`
        SELECT true
        FROM
          "public"."migration"
        WHERE
          "name" = ${name}
      `);

      if (exists === true) {
        continue;
      }

      console.log(`Running migration: ${name}`);

      const result = await migration.run({ connection, sql });
      if (result) {
        await connection.query(result);
      }

      // TODO: hash verification (but tbh nobody cares about that)
      await connection.query(sql`
        INSERT INTO "public"."migration" ("name", "hash")
        VALUES (${name}, ${name});
      `);

      if (args.runTo && args.runTo === name) {
        console.log(`reached migration '${name}'. Stopping.`);
        break;
      }
    }
  });

  console.log('Done.');
}
