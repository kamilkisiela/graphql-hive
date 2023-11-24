import type { MigrationExecutor } from '../pg-migrator';

export default {
  name: '2023.11.09T00.00.00.schema-check-approval.ts',
  run: ({ sql }) => sql`
    CREATE TABLE "public"."schema_change_approvals" (
      "target_id" UUID NOT NULL REFERENCES "targets" ("id") ON DELETE CASCADE,
      "context_id" text NOT NULL,
      "schema_change_id" text NOT NULL,
      "schema_change" jsonb NOT NULL,
      "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY ("target_id", "context_id", "schema_change_id")
    );

    ALTER TABLE "public"."schema_checks"
      ADD COLUMN "context_id" text
    ;
  `,
} satisfies MigrationExecutor;
