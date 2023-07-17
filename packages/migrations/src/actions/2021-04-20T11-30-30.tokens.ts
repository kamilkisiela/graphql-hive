import { type MigrationExecutor } from '../pg-migrator';

export default {
  name: '2021-04-20T11-30-30.tokens.sql',
  run: ({ sql }) => sql`
--tokens (up)
ALTER TABLE
  public.tokens
DROP COLUMN
  last_used_at;
`,
} satisfies MigrationExecutor;
