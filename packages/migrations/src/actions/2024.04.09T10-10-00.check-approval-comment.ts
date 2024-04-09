import { type MigrationExecutor } from '../pg-migrator';

export default {
  name: '2024.04.09T10.10.00.check-approval-comment.ts',
  run: ({ sql }) => sql`
    ALTER TABLE "schema_checks" ADD COLUMN IF NOT EXISTS "manual_approval_comment" text;
  `,
} satisfies MigrationExecutor;
