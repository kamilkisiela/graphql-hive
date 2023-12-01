import { type MigrationExecutor } from '../pg-migrator';

export default {
  name: '2022.03.28T10.31.26.github-integration.sql',
  run: ({ sql }) => sql`
--slack-integration (up)
ALTER TABLE
  organizations
ADD COLUMN
  github_app_installation_id TEXT;

ALTER TABLE
  projects
ADD COLUMN
  git_repository TEXT;
`,
} satisfies MigrationExecutor;
