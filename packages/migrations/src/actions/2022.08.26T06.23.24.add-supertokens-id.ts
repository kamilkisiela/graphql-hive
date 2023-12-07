import { type MigrationExecutor } from '../pg-migrator';

export default {
  name: '2022.08.26T06.23.24.add-supertokens-id.sql',
  run: ({ sql }) => sql`
ALTER TABLE
  users
ADD COLUMN
  supertoken_user_id VARCHAR(50),
ADD
  CONSTRAINT supertoken_user_id_unique UNIQUE (supertoken_user_id),
ALTER COLUMN
  external_auth_user_id
DROP NOT NULL
,
ADD COLUMN
  "is_admin" BOOLEAN;
  `,
} satisfies MigrationExecutor;
