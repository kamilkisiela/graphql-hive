import { type MigrationExecutor } from "../pg-migrator"

export default {
  name: '2023.02.21T14.32.24.supertokens-4.0.0.ts',
  run: ({ sql }) => sql`
ALTER TABLE IF EXISTS
  public.supertokens_thirdparty_users
ALTER COLUMN
  third_party_user_id
TYPE
  VARCHAR(256);

ALTER TABLE IF EXISTS
  public.supertokens_emailpassword_users
ALTER COLUMN
  password_hash
TYPE
  VARCHAR(256);
  `,
} satisfies MigrationExecutor
