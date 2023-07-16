import { type MigrationExecutor } from "../pg-migrator"

export default {
  name: '2021-04-30T07-01-57.token-per-target.sql',
  run: ({ sql }) => sql`
--token-per-target (up)
ALTER TABLE
  public.tokens
ADD COLUMN
  target_id UUID NOT NULL REFERENCES public.targets (id) ON DELETE CASCADE;

ALTER TABLE
  public.tokens
ADD COLUMN
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE;
`
} satisfies MigrationExecutor
