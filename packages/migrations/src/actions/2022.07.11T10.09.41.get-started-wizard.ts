import { type MigrationExecutor } from '../pg-migrator';

export default {
  name: '2022.07.11T10.09.41.get-started-wizard.sql',
  run: ({ sql }) => sql`
-- Tracks feature discovery progress
ALTER TABLE
  public.organizations
ADD COLUMN
  get_started_creating_project BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN
  get_started_publishing_schema BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN
  get_started_checking_schema BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN
  get_started_inviting_members BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN
  get_started_reporting_operations BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN
  get_started_usage_breaking BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE
  public.organizations
SET
  get_started_creating_project = TRUE
WHERE
  id IN (
    SELECT
      org_id
    FROM
      public.projects
    GROUP BY
      org_id
  );

UPDATE
  public.organizations
SET
  get_started_publishing_schema = TRUE
WHERE
  id IN (
    SELECT
      p.org_id
    FROM
      public.commits AS c
      INNER JOIN public.projects AS p ON p.id = c.project_id
    GROUP BY
      p.org_id
  );

UPDATE
  public.organizations
SET
  get_started_inviting_members = TRUE
WHERE
  id IN (
    SELECT
      organization_id
    FROM
      public.organization_member
    GROUP BY
      organization_id
    HAVING
      COUNT(user_id) > 1
  );

UPDATE
  public.organizations
SET
  get_started_usage_breaking = TRUE
WHERE
  id IN (
    SELECT
      p.org_id
    FROM
      public.targets AS t
      INNER JOIN public.projects AS p ON p.id = t.project_id
    WHERE
      t.validation_enabled IS TRUE
  );
`,
} satisfies MigrationExecutor;
