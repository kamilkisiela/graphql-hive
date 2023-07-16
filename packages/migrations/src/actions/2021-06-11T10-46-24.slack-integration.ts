import { type MigrationExecutor } from "../pg-migrator"

export default {
  name: '2021-06-11T10-46-24.slack-integration.sql',
  run: ({ sql }) => sql`
--slack-integration (up)
ALTER TABLE
  public.organizations
ADD COLUMN
  slack_token TEXT;
`
} satisfies MigrationExecutor
