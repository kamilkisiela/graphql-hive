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
      "contract_name" text NOT NULL,
      "include_tags" text[],
      "exclude_tags" text[],
      "remove_unreachable_types_from_public_api_schema" boolean NOT NULL,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      UNIQUE ("target_id", "contract_name")
    );

    CREATE INDEX "contracts_connection_pagination" ON "contracts" (
      "target_id" ASC,
      "created_at" DESC,
      "id" DESC
    );

    CREATE TABLE "contract_versions" (
      "id" UUID PRIMARY KEY NOT NULL DEFAULT uuid_generate_v4(),
      "schema_version_id" UUID NOT NULL REFERENCES "schema_versions" ("id") ON DELETE CASCADE,
      "previous_contract_version_id" UUID REFERENCES "contract_versions" ("id"),
      "diff_contract_version_id" UUID REFERENCES "contract_versions" ("id"),
      "contract_id" UUID NOT NULL REFERENCES "contracts" ("id") ON DELETE SET NULL,
      "contract_name" text NOT NULL,
      "schema_composition_errors" jsonb,
      "composite_schema_sdl" text,
      "supergraph_sdl" text,
      "created_at" timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX "contract_versions_find_latest_valid_version" ON "contract_versions" (
      "contract_id" ASC,
      "created_at" DESC
    )
    WHERE
      "schema_composition_errors" IS NULL
    ;

    CREATE TABLE "contract_version_changes" (
      "id" UUID PRIMARY KEY NOT NULL DEFAULT uuid_generate_v4(),
      "contract_version_id" UUID NOT NULL REFERENCES "contract_versions" ("id"),
      "change_type" TEXT NOT NULL,
      "severity_level" TEXT NOT NULL,
      "meta" jsonb NOT NULL,
      "is_safe_based_on_usage" BOOLEAN NOT NULL
    );

    CREATE TABLE "contract_checks" (
      "id" UUID PRIMARY KEY NOT NULL DEFAULT uuid_generate_v4(),
      "schema_check_id" UUID NOT NULL REFERENCES "schema_checks" ("id") ON DELETE CASCADE,
      "compared_contract_version_id" UUID REFERENCES "contract_versions" ("id") ON DELETE CASCADE,
      "is_success" boolean NOT NULL,
      "contract_name" text NOT NULL,
      "composite_schema_sdl_store_id" text,
      "supergraph_sdl_store_id" text,
      "schema_composition_errors" jsonb,
      "breaking_schema_changes" jsonb,
      "safe_schema_changes" jsonb
    );

    CREATE INDEX "contract_checks_pagination" ON "contract_checks" (
      "schema_check_id" ASC,
      "contract_name" ASC
    );
  `,
} satisfies MigrationExecutor;
