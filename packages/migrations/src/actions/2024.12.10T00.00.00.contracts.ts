import type { MigrationExecutor } from '../pg-migrator';

export default {
  name: '2024.12.10T00.00.00.contracts.ts',
  run: ({ sql }) => sql`
    ALTER TABLE "schema_versions"
      ADD COLUMN "tags" text[]
    ;

    CREATE TABLE "contracts" (
      "id" UUID PRIMARY KEY NOT NULL DEFAULT uuid_generate_v4(),
      "target_id" UUID NOT NULL REFERENCES "targets" ("id"),
      "user_specified_contract_id" text NOT NULL,
      "include_tags" text[],
      "exclude_tags" text[],
      "remove_unreachable_types_from_public_api_schema" boolean NOT NULL,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      UNIQUE ("target_id", "user_specified_contract_id")
    );

    CREATE INDEX "contracts_connection_pagination" ON "contracts" (
      "target_id" ASC,
      "created_at" DESC,
      "id" DESC
    );

    CREATE TABLE "schema_version_contracts" (
      "id" UUID PRIMARY KEY NOT NULL DEFAULT uuid_generate_v4(),
      "schema_version_id" UUID NOT NULL REFERENCES "schema_versions" ("id"),
      "last_schema_version_contract_id" UUID REFERENCES "schema_version_contracts" ("id"),
      "contract_id" UUID NOT NULL REFERENCES "contracts" ("id"),
      "is_composable" boolean NOT NULL,
      "schema_composition_errors" jsonb,
      "composite_schema_sdl" text,
      "supergraph_sdl" text,
      "created_at" timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE "schema_version_contract_changes" (
      "id" UUID PRIMARY KEY NOT NULL DEFAULT uuid_generate_v4(),
      "schema_version_contract_id" UUID NOT NULL REFERENCES "schema_version_contracts" ("id"),
      "severity_level" TEXT NOT NULL,
      "change_type" TEXT NOT NULL,
      "meta" jsonb NOT NULL,
      "is_safe_based_on_usage" BOOLEAN NOT NULL
    );
  `,
} satisfies MigrationExecutor;
