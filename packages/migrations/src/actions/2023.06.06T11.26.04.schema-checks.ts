import { type MigrationExecutor } from '../pg-migrator';

export default {
  name: '2023.06.06T11.26.04.schema-checks.sql',
  run: ({ sql }) => sql`
CREATE TABLE "public"."schema_checks" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT uuid_generate_v4()
  , "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
  , "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()

  , "schema_sdl" text NOT NULL
  , "service_name" text
  , "meta" jsonb

  , "target_id" uuid NOT NULL REFERENCES "targets" ("id") ON DELETE CASCADE
  , "schema_version_id" uuid REFERENCES "schema_versions" ("id") ON DELETE CASCADE

  , "is_success" boolean NOT NULL

  , "schema_composition_errors" jsonb

  , "breaking_schema_changes" jsonb
  , "safe_schema_changes" jsonb
  , "schema_policy_warnings" jsonb
  , "schema_policy_errors" jsonb

  , "composite_schema_sdl" text
  , "supergraph_sdl" text
);

CREATE INDEX "schema_checks_connection_pagination" ON "schema_checks" (
  "target_id" ASC
  , "created_at" DESC
  , "id" DESC
);
  `,
} satisfies MigrationExecutor;
