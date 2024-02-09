import type { MigrationExecutor } from '../pg-migrator';

export default {
  name: '2024.01.26T00.00.01.schema-check-pagination-index-update',
  noTransaction: true,
  run: ({ sql }) => [
    {
      name: 'create index schema_checks_connection_pagination_with_changes_new',
      query: sql`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS "schema_checks_connection_pagination_with_changes_new" ON "schema_checks" (
          "target_id" ASC
          , "created_at" DESC
          , "id" DESC
        )
        WHERE
          jsonb_typeof("safe_schema_changes") = 'array'
          OR jsonb_typeof("breaking_schema_changes") = 'array'
          OR "has_contract_schema_changes" = true
        ;
      `,
    },
    {
      name: 'create index schema_checks_connection_pagination_with_no_success_and_changes_new',
      query: sql`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS  "schema_checks_connection_pagination_with_no_success_and_changes_new" ON "schema_checks" (
          "target_id" ASC
          , "created_at" DESC
          , "id" DESC
        )
        WHERE
          "is_success" = false
          AND  (
            jsonb_typeof("safe_schema_changes") = 'array'
            OR jsonb_typeof("breaking_schema_changes") = 'array'
            OR "has_contract_schema_changes" = true
          )
        ;
      `,
    },
    {
      name: 'drop index schema_checks_connection_pagination_with_changes',
      query: sql`
        DROP INDEX CONCURRENTLY IF EXISTS "schema_checks_connection_pagination_with_changes";
      `,
    },
    {
      name: 'drop index schema_checks_connection_pagination_with_no_success_and_changes',
      query: sql`
        DROP INDEX CONCURRENTLY IF EXISTS "schema_checks_connection_pagination_with_no_success_and_changes";
      `,
    },
    {
      name: 'create index contract_checks_supergraph_sdl_store_id index',
      query: sql`
        CREATE INDEX CONCURRENTLY "contract_checks_supergraph_sdl_store_id" ON "contract_checks" (
          "supergraph_sdl_store_id" ASC
        );
      `,
    },
    {
      name: 'create index contract_checks_composite_schema_sdl_store_id',
      query: sql`
        CREATE INDEX CONCURRENTLY "contract_checks_composite_schema_sdl_store_id" ON "contract_checks" (
          "composite_schema_sdl_store_id" ASC
        );
      `,
    },
  ],
} satisfies MigrationExecutor;
