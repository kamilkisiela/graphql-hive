import { type MigrationExecutor } from '../pg-migrator';

export default {
  name: '2022.05.03T15.58.13.org_rate_limits.sql',
  run: ({ sql }) => sql`
ALTER TABLE
  organizations
ADD COLUMN
  limit_operations_monthly BIGINT NOT NULL DEFAULT 1000000;

-- HOBBY plan is default
ALTER TABLE
  organizations
ADD COLUMN
  limit_schema_push_monthly BIGINT NOT NULL DEFAULT 50;

-- HOBBY plan is default
ALTER TABLE
  organizations
ADD COLUMN
  limit_retention_days BIGINT NOT NULL DEFAULT 3;

-- HOBBY plan is default
`,
} satisfies MigrationExecutor;
