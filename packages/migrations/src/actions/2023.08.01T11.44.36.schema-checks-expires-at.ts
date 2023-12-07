import { type MigrationExecutor } from '../pg-migrator';

export default {
  name: '2023.08.01T11.44.36.schema-checks-expires-at.ts',
  run: ({ sql }) => sql`
    ALTER TABLE "schema_checks"
      ADD COLUMN "expires_at" TIMESTAMP WITH TIME ZONE
    ;

    CREATE INDEX
      "schema_checks_expires_at_pagination" ON "schema_checks" ("expires_at" ASC)
    ;
  `,
} satisfies MigrationExecutor;
