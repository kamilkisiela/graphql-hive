import { type MigrationExecutor } from '../pg-migrator';

export default {
  name: '2024.05.13T10-10-00.app-deployments.ts',
  run: ({ sql }) => sql`
    CREATE TABLE IF NOT EXISTS "app_deployments" (
      "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      "target_id" UUID NOT NULL REFERENCES "targets" ("id") ON DELETE CASCADE,
      "name" TEXT NOT NULL,
      "version" TEXT NOT NULL,
      "created_at" TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      "activated_at" TIMESTAMPTZ,
      "retired_at" TIMESTAMPTZ,
      UNIQUE ("target_id", "name", "version")
    );

    CREATE INDEX "app_deployments_pagination" ON "app_deployments" ("target_id", "created_at", "id");
  `,
} satisfies MigrationExecutor;
