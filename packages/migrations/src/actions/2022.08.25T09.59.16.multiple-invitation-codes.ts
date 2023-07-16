import { type MigrationExecutor } from "../pg-migrator"

export default {
  name: '2022.08.25T09.59.16.multiple-invitation-codes.sql',
  run: ({ sql }) => sql`
ALTER TABLE
  public.organizations
DROP COLUMN
  invite_code;

CREATE TABLE
  public.organization_invitations (
    organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
    code VARCHAR(10) NOT NULL UNIQUE DEFAULT SUBSTR(MD5(RANDOM()::TEXT), 0, 10),
    email VARCHAR(320) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW() + INTERVAL '7 days',
    PRIMARY KEY (organization_id, email)
  );
`,
} satisfies MigrationExecutor
