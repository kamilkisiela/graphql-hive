import { type MigrationExecutor } from '../pg-migrator';

export default {
  name: '2023.12.15T10-00-00.usage-token.ts',
  noTransaction: true,
  run: ({ sql }) => [
    {
      name: 'Update scopes in organization_member_roles',
      query: sql`
        UPDATE organization_member_roles
        SET scopes = array_append(scopes, 'target:usage:write')
        WHERE scopes @> ARRAY['target:registry:write'];

        UPDATE organization_member_roles
        SET scopes = array_append(scopes, 'target:usage:read')
        WHERE scopes @> ARRAY['target:registry:read'];
      `,
    },
    {
      name: 'Update scopes in organization_member',
      query: sql`
        UPDATE organization_member
        SET scopes = array_append(scopes, 'target:usage:write')
        WHERE scopes @> ARRAY['target:registry:write'];

        UPDATE organization_member
        SET scopes = array_append(scopes, 'target:usage:read')
        WHERE scopes @> ARRAY['target:registry:read'];
      `,
    },
  ],
} satisfies MigrationExecutor;
