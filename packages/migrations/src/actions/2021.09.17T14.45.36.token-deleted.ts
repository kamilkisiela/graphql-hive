import { type MigrationExecutor } from "../pg-migrator"

export default {
  name: '2021.09.17T14.45.36.token-deleted.sql',
  run: ({ sql }) => sql`
ALTER TABLE
  public.tokens
ADD COLUMN
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
`
} satisfies MigrationExecutor
