import { type MigrationExecutor } from "../pg-migrator"

export default {
  name: '2023.02.22T09.27.02.delete-personal-org.sql',
  run: ({ sql }) => sql`
-- Find and delete all organizations of type PERSONAL that have no projects
DELETE FROM
  public.organizations AS o
WHERE
  o.type = 'PERSONAL'
  AND NOT EXISTS (
    SELECT
      id
    FROM
      public.projects AS p
    WHERE
      p.org_id = o.id
    LIMIT
      1
  );

-- Delete the "type" column from organizations
ALTER TABLE
  public.organizations
DROP COLUMN
TYPE;

-- Delete the "organization_type" enum, as it's unused now
DROP TYPE
  organization_type;
`,
} satisfies MigrationExecutor