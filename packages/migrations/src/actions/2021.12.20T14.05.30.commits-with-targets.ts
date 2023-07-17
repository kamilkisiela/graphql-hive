import { type MigrationExecutor } from '../pg-migrator';

export default {
  name: '2021.12.20T14.05.30.commits-with-targets.sql',
  run: ({ sql }) => sql`
--creates and fills a target_id column on public.commits
ALTER TABLE
  public.commits
ADD COLUMN
  target_id UUID REFERENCES public.targets (id) ON DELETE CASCADE;

UPDATE
  public.commits AS c
SET
  target_id = v.target_id
FROM
  public.versions AS v
WHERE
  v.commit_id = c.id;

ALTER TABLE
  public.commits
ALTER COLUMN
  target_id
SET NOT NULL;
`,
} satisfies MigrationExecutor;
