import { type MigrationExecutor } from '../pg-migrator';

export default {
  name: '2022.11.07T09.30.47.user-table-varchar-to-text.sql',
  run: ({ sql }) => sql`
ALTER TABLE
  "public"."users"
ALTER COLUMN
  "supertoken_user_id"
TYPE
  VARCHAR(300),
ALTER COLUMN
  "external_auth_user_id"
TYPE
  VARCHAR(300);
  `,
} satisfies MigrationExecutor;
