import { type MigrationExecutor } from "../pg-migrator"

export default {
  name: '2021-03-09T10-30-35.roles.sql',
  run: ({ sql }) => sql`
--roles (up)
CREATE TYPE
  user_role AS ENUM('ADMIN', 'MEMBER');

ALTER TABLE
  public.organization_member
ADD COLUMN
  ROLE user_role NOT NULL DEFAULT 'MEMBER';

UPDATE
  public.organization_member AS om
SET ROLE
  = 'ADMIN'
WHERE
  (
    SELECT
      o.user_id
    FROM
      public.organizations AS o
    WHERE
      o.id = om.organization_id
      AND o.user_id = om.user_id
  ) IS NOT NULL;
`
} satisfies MigrationExecutor
