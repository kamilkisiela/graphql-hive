import { type MigrationExecutor } from '../pg-migrator';

export default {
  name: '2023.07.10T11.26.04.schema-checks-manual-approval.sql',
  run: ({ sql }) => sql`
ALTER TABLE "schema_checks"
  ADD COLUMN "github_check_run_id" bigint
  , ADD COLUMN "is_manually_approved" boolean
  , ADD COLUMN "manual_approval_user_id" uuid REFERENCES "users" ("id") ON DELETE SET NULL
;
  `,
} satisfies MigrationExecutor;
