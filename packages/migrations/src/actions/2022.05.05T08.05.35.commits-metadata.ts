import { type MigrationExecutor } from '../pg-migrator';

export default {
  name: '2022.05.05T08.05.35.commits-metadata.sql',
  run: ({ sql }) => sql`
ALTER TABLE
  commits
ADD COLUMN
  "metadata" TEXT;
`,
} satisfies MigrationExecutor;
