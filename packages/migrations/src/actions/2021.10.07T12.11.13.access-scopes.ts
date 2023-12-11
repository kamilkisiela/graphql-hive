import { type MigrationExecutor } from '../pg-migrator';

export default {
  name: '2021.10.07T12.11.13.access-scopes.sql',
  run: ({ sql }) => sql`
-- Adds scopes to tokens
ALTER TABLE
  tokens
ADD COLUMN
  scopes TEXT[] DEFAULT NULL;

-- Adds scopes to organization_member
ALTER TABLE
  organization_member
ADD COLUMN
  scopes TEXT[] DEFAULT NULL;

-- Adds scopes to existing regular members
UPDATE
  organization_member
SET
  scopes = ARRAY[
    'organization:read',
    'project:read',
    'project:operations-store:read',
    'target:read',
    'target:registry:read'
  ]
WHERE
  ROLE = 'MEMBER';

-- Adds scopes to existing admin members
UPDATE
  organization_member
SET
  scopes = ARRAY[
    'organization:read',
    'organization:delete',
    'organization:settings',
    'organization:integrations',
    'organization:members',
    'project:read',
    'project:delete',
    'project:settings',
    'project:alerts',
    'project:operations-store:read',
    'project:operations-store:write',
    'target:read',
    'target:delete',
    'target:settings',
    'target:registry:read',
    'target:registry:write',
    'target:tokens:read',
    'target:tokens:write'
  ]
WHERE
  ROLE = 'ADMIN';

-- Adds scopes to existing tokens
UPDATE
  tokens
SET
  scopes = ARRAY[
    'organization:read',
    'project:read',
    'project:operations-store:read',
    'project:operations-store:write',
    'target:read',
    'target:registry:read',
    'target:registry:write'
  ]
`,
} satisfies MigrationExecutor;
