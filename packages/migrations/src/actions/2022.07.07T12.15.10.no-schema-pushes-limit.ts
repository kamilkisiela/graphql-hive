import { type MigrationExecutor } from "../pg-migrator"

export default {
  name: '2022.07.07T12.15.10.no-schema-pushes-limit.sql',
  run: ({ sql }) => sql`
ALTER TABLE
  public.organizations
DROP COLUMN
  limit_schema_push_monthly;
`,
} satisfies MigrationExecutor
