import { type MigrationExecutor } from '../pg-migrator';

export default {
  name: '2022.07.11T20.09.37.migrate-pro-hobby-retention.sql',
  run: ({ sql }) => sql`
-- Update Hobby with 3d to 7d
UPDATE
  organizations
SET
  limit_retention_days = 7
WHERE
  plan_name = 'HOBBY'
  AND limit_retention_days = 3;

-- Update Pro with 180d to 90d
UPDATE
  organizations
SET
  limit_retention_days = 90
WHERE
  plan_name = 'PRO'
  AND limit_retention_days = 180;
`,
} satisfies MigrationExecutor;
