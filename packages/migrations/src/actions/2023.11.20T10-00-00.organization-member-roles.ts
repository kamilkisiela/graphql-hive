import { type MigrationExecutor } from '../pg-migrator';

export default {
  name: '2023.11.20T10-00-00.organization-member-roles.ts',
  noTransaction: true,
  run: ({ sql }) => [
    {
      name: 'Create organization_roles and alter organization_member table',
      query: sql`
        CREATE TABLE organization_member_roles (
          "id" uuid NOT NULL UNIQUE DEFAULT uuid_generate_v4(),
          "organization_id" uuid NOT NULL REFERENCES "organizations" ("id") ON DELETE CASCADE,
          "name" text NOT NULL,
          "description" text NOT NULL,
          "scopes" TEXT[] NOT NULL,
          "locked" boolean NOT NULL DEFAULT false,

          CONSTRAINT organization_member_roles_name_per_org UNIQUE (name, organization_id),
          PRIMARY KEY (id, organization_id)
        );

        CREATE INDEX "organization_member_roles_locked" ON "organization_member_roles" ("locked" ASC);

        ALTER TABLE organization_member ADD COLUMN "role_id" uuid REFERENCES "organization_member_roles" ("id");
      `,
    },
    {
      name: 'Create Admin role',
      query: sql`
        INSERT INTO organization_member_roles
          (
            organization_id,
            name,
            description,
            scopes,
            locked
          )
        SELECT
          id
            as organization_id,
          'Admin'
            as name,
          'Full access to all organization resources'
            as description,
          ARRAY[
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
          ] as scopes,
          true as locked
        FROM organizations;
      `,
    },
    {
      name: 'Create Contributor role',
      query: sql`
        INSERT INTO organization_member_roles
          (
            organization_id,
            name,
            description,
            scopes,
            locked
          )
        SELECT
          id
            as organization_id,
          'Contributor'
            as name,
          'Manage projects without the ability to perform harmful actions (such as accessing organization settings, members and removing resources)'
            as description,
          ARRAY[
            'organization:read',
            'project:read',
            'project:settings',
            'project:alerts',
            'project:operations-store:read',
            'project:operations-store:write',
            'target:read',
            'target:settings',
            'target:registry:read',
            'target:registry:write',
            'target:tokens:read',
            'target:tokens:write'
          ] as scopes,
          false as locked
        FROM organizations;
      `,
    },
    {
      name: 'Create Viewer role',
      query: sql`
        INSERT INTO organization_member_roles
          (
            organization_id,
            name,
            description,
            scopes,
            locked
          )
        SELECT
          id
            as organization_id,
          'Viewer'
            as name,
          'Read-only access to all organization resources'
            as description,
          ARRAY[
            'organization:read',
            'project:read',
            'project:operations-store:read',
            'target:read',
            'target:registry:read'
          ] as scopes,
          true as locked
        FROM organizations;
      `,
    },
    {
      name: 'Assign roles to users with matching scopes',
      query: sql`
        UPDATE organization_member
        SET role_id = (
            SELECT id
            FROM organization_member_roles
            WHERE 
                organization_member_roles.organization_id = organization_member.organization_id
              AND
                ARRAY(SELECT unnest(organization_member_roles.scopes) ORDER BY 1)
                = ARRAY(SELECT unnest(organization_member.scopes) ORDER BY 1)
            LIMIT 1
        )
        WHERE role_id IS NULL; -- Update only rows where role_id is not already set
      `,
    },
    {
      name: 'Migrate organization_invitations table to use Viewer role',
      query: sql`
        ALTER TABLE organization_invitations ADD COLUMN "role_id" uuid REFERENCES "organization_member_roles" ("id");

        UPDATE organization_invitations
        SET role_id = (
            SELECT id
            FROM organization_member_roles
            WHERE 
                organization_member_roles.organization_id = organization_invitations.organization_id
              AND
                locked = true
              AND
                name = 'Viewer'
            LIMIT 1
        )
        WHERE role_id IS NULL;

        ALTER TABLE organization_invitations ALTER COLUMN "role_id" SET NOT NULL;
      `,
    },
  ],
} satisfies MigrationExecutor;
