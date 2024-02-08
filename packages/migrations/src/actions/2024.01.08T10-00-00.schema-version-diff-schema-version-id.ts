import { type MigrationExecutor } from '../pg-migrator';

export default {
  name: '2024.01.08T10-00-00.schema-version-diff-schema-version-id',
  noTransaction: true,
  run: ({ sql }) => [
    {
      name: 'add diff_schema_version_id column',
      query: sql`
        ALTER TABLE "schema_versions"
          ADD COLUMN IF NOT EXISTS "diff_schema_version_id" uuid REFERENCES "schema_versions" ("id")
          , ADD COLUMN IF NOT EXISTS "record_version" text
        ;
      `,
    },
    {
      name: 'create schema_versions_cursor_pagination index',
      query: sql`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS "schema_versions_cursor_pagination" ON "schema_versions" (
          "target_id" ASC
          , "created_at" DESC
          , "id" DESC
        );
      `,
    },
    {
      name: 'create schema_versions_cursor_pagination index',
      query: sql`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS "schema_versions_cursor_pagination_composable" ON "schema_versions" (
            "target_id" ASC
            , "created_at" DESC
            , "id" DESC
        )
        WHERE
          "is_composable" = TRUE
        ;
      `,
    },
  ],
} satisfies MigrationExecutor;
