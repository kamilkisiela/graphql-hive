import { type MigrationExecutor } from '../pg-migrator';

export default {
  name: '2024.09.26T00.00.00.create-preflight-scripts.sql',
  run: ({ sql }) => sql`
CREATE TABLE "document_preflight_scripts" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "source_code" text NOT NULL,
  "target_id" uuid NOT NULL REFERENCES "targets"("id") ON DELETE CASCADE,
  "created_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

CREATE INDEX "document_preflight_scripts_connection_pagination" ON "document_preflight_scripts" (
  "target_id" ASC,
  "created_at" DESC,
  "id" DESC
);
`,
} satisfies MigrationExecutor;
