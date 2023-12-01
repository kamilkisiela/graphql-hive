import { type MigrationExecutor } from '../pg-migrator';

export default {
  name: '2022.07.11T10.09.41.get-started-wizard.sql',
  run: ({ sql }) => sql`
-- Tracks feature discovery progress
ALTER TABLE
  organizations
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
  organizations
SET
  get_started_creating_project = TRUE
WHERE
  id IN (
    SELECT
      org_id
    FROM
      projects
    GROUP BY
      org_id
  );

UPDATE
  organizations
SET
  get_started_publishing_schema = TRUE
WHERE
  id IN (
    SELECT
      p.org_id
    FROM
      commits AS c
      INNER JOIN projects AS p ON p.id = c.project_id
    GROUP BY
      p.org_id
  );

UPDATE
  organizations
SET
  get_started_inviting_members = TRUE
WHERE
  id IN (
    SELECT
      organization_id
    FROM
      organization_member
    GROUP BY
      organization_id
    HAVING
      COUNT(user_id) > 1
  );

UPDATE
  organizations
SET
  get_started_usage_breaking = TRUE
WHERE
  id IN (
    SELECT
      p.org_id
    FROM
      targets AS t
      INNER JOIN projects AS p ON p.id = t.project_id
    WHERE
      t.validation_enabled IS TRUE
  );
`,
} satisfies MigrationExecutor;
