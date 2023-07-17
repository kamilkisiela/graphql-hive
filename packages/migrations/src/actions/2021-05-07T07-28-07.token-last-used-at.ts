import { type MigrationExecutor } from '../pg-migrator';

export default {
  name: '2021-05-07T07-28-07.token-last-used-at.sql',
  run: ({ sql }) => sql`
--token-last-used-at (up)
ALTER TABLE
  public.tokens
ADD COLUMN
  last_used_at TIMESTAMP WITH TIME ZONE;
`,
} satisfies MigrationExecutor;
