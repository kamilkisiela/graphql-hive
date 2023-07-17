import { type MigrationExecutor } from '../pg-migrator';

export default {
  name: '2021.11.22T11.23.44.base-schema.sql',
  run: ({ sql }) => sql`
-- Adds a base schema column in target table and versions table
ALTER TABLE
  public.targets
ADD
  base_schema TEXT;

ALTER TABLE
  public.versions
ADD
  base_schema TEXT;
`,
} satisfies MigrationExecutor;
