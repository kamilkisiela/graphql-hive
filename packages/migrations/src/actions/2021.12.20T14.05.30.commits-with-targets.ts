import { type MigrationExecutor } from '../pg-migrator';

export default {
  name: '2021.12.20T14.05.30.commits-with-targets.sql',
  run: ({ sql }) => sql`
--creates and fills a target_id column on commits
ALTER TABLE
  commits
ADD COLUMN
  target_id UUID REFERENCES targets (id) ON DELETE CASCADE;

UPDATE
  commits AS c
SET
  target_id = v.target_id
FROM
  versions AS v
WHERE
  v.commit_id = c.id;

ALTER TABLE
  commits
ALTER COLUMN
  target_id
SET NOT NULL;
`,
} satisfies MigrationExecutor;
