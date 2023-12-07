import { type MigrationExecutor } from '../pg-migrator';

export default {
  name: '2021-03-15T19-32-01.commit-project-id.sql',
  run: ({ sql }) => sql`
--commit-project-id (up)
ALTER TABLE
  commits
ADD COLUMN
  project_id UUID REFERENCES projects (id) ON DELETE CASCADE;

UPDATE
  commits AS c
SET
  project_id = t.project_id
FROM
  versions AS v,
  targets AS t
WHERE
  v.commit_id = c.id
  AND t.id = v.target_id;

ALTER TABLE
  commits
ALTER COLUMN
  project_id
SET NOT NULL;
`,
} satisfies MigrationExecutor;
