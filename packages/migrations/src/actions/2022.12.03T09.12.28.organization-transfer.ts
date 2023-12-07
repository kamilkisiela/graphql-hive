import { type MigrationExecutor } from '../pg-migrator';

export default {
  name: '2022.12.03T09.12.28.organization-transfer.sql',
  run: ({ sql }) => sql`
ALTER TABLE
  organizations
ADD COLUMN
  ownership_transfer_user_id UUID REFERENCES users (id),
ADD COLUMN
  ownership_transfer_code VARCHAR(10),
ADD COLUMN
  ownership_transfer_expires_at TIMESTAMP WITH TIME ZONE;
  `,
} satisfies MigrationExecutor;
