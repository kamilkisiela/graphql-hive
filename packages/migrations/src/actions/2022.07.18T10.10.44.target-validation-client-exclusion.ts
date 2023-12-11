import { type MigrationExecutor } from '../pg-migrator';

export default {
  name: '2022.07.18T10.10.44.target-validation-client-exclusion.sql',
  run: ({ sql }) => sql`
ALTER TABLE
  targets
ADD COLUMN
  validation_excluded_clients TEXT[];
`,
} satisfies MigrationExecutor;
