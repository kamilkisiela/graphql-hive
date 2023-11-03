import { type MigrationExecutor } from '../pg-migrator';

export default {
  name: '2023.10.25T14.41.41.schema-checks-dedup.ts',
  noTransaction: true,
  run: ({ sql }) => [
    {
      name: 'create sdl_store and alter schema_checks',
      query: sql`
        CREATE TABLE "public"."sdl_store" (
          "id" text PRIMARY KEY NOT NULL,
          "sdl" text NOT NULL
        );
        
        ALTER TABLE "public"."schema_checks"
          ADD COLUMN "schema_sdl_store_id" text REFERENCES "public"."sdl_store" ("id"),
          ADD COLUMN "supergraph_sdl_store_id" text REFERENCES "public"."sdl_store" ("id"),
          ADD COLUMN "composite_schema_sdl_store_id" text REFERENCES "public"."sdl_store" ("id");

        ALTER TABLE "public"."schema_checks"
          ALTER COLUMN "schema_sdl" DROP NOT NULL,
          ALTER COLUMN "supergraph_sdl" DROP NOT NULL,
          ALTER COLUMN "composite_schema_sdl" DROP NOT NULL;
      `,
    },
    {
      name: 'Create sdl_store_unique_id index',
      query: sql`
        CREATE UNIQUE INDEX sdl_store_unique_id ON "public"."sdl_store" ("id");
      `,
    },
    {
      name: 'Create schema_check_by_schema_sdl_store_id index',
      query: sql`
        CREATE INDEX CONCURRENTLY "schema_check_by_schema_sdl_store_id" ON "public"."schema_checks" ("schema_sdl_store_id" ASC)
      `,
    },
    {
      name: 'Create schema_check_by_supergraph_sdl_store_id index',
      query: sql`
        CREATE INDEX CONCURRENTLY "schema_check_by_supergraph_sdl_store_id" ON "public"."schema_checks" ("supergraph_sdl_store_id" ASC)
      `,
    },
    {
      name: 'Create schema_check_by_composite_schema_sdl_store_id index',
      query: sql`
        CREATE INDEX CONCURRENTLY "schema_check_by_composite_schema_sdl_store_id" ON "public"."schema_checks" ("composite_schema_sdl_store_id" ASC);
      `,
    },
  ],
} satisfies MigrationExecutor;
