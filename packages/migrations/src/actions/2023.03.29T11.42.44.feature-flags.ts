import { type MigrationExecutor } from "../pg-migrator"

export default {
  name: '2023.03.29T11.42.44.feature-flags.sql',
  run: ({ sql }) => sql`
ALTER TABLE
  public.organizations
ADD COLUMN
  feature_flags JSONB
  `,
} satisfies MigrationExecutor
