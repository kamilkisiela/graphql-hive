import assert from 'node:assert';
import { describe, test } from 'node:test';
import { sql } from 'slonik';
import { createStorage } from '../../services/storage/src/index';
import { initMigrationTestingEnvironment } from './utils/testkit';

await describe('migration: usage-token', async () => {
  await test('should replace target:registry:{read,write} with target:usage:{read,write}', async () => {
    const { db, runTo, complete, done, seed, connectionString } =
      await initMigrationTestingEnvironment();
    const storage = await createStorage(connectionString, 1);
    try {
      await runTo('2023.11.09T00.00.00.schema-check-approval.ts');

      // Seed the database with some data (schema_sdl, supergraph_sdl, composite_schema_sdl)
      const admin = await seed.user({
        user: {
          name: 'test1',
          email: 'test1@test.com',
        },
      });
      const developer = await seed.user({
        user: {
          name: 'test2',
          email: 'test2@test.com',
        },
      });
      const noRoleUser = await seed.user({
        user: {
          name: 'test3',
          email: 'test3@test.com',
        },
      });
      const organization = await seed.organization({
        organization: {
          name: 'org-1',
        },
        user: admin,
      });

      const developerScopes = [
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
        'target:tokens:write',
      ];
      const noRoleUserScopes = [
        'organization:read',
        'project:read',
        'target:read',
        'project:alerts',
        'target:registry:read',
      ];

      await runTo('2023.11.20T10-00-00.organization-member-roles.ts');

      const adminRoleId = await db.oneFirst<string>(sql`
        SELECT id FROM organization_member_roles WHERE name = 'Admin' AND organization_id = ${organization.id}
      `);

      const developerRoleId = await db.oneFirst<string>(sql`
        INSERT INTO organization_member_roles
          (
            organization_id,
            name,
            description,
            scopes,
            locked
          )
        VALUES
          (${organization.id}, 'Developer', 'Developer', ${sql.array(
            developerScopes,
            'text',
          )}, ${false})
        RETURNING id
      `);

      await db.query(sql`
        INSERT INTO organization_member (organization_id, user_id, scopes, role_id)
        VALUES
          (${organization.id}, ${admin.id}, ARRAY[]::text[], ${adminRoleId}),
          (${organization.id}, ${developer.id}, ${sql.array(
            developerScopes,
            'text',
          )}, ${developerRoleId}),
          (${organization.id}, ${noRoleUser.id}, ${sql.array(noRoleUserScopes, 'text')}, ${null})
      `);

      assert.deepStrictEqual(
        await db.oneFirst(sql`
        SELECT scopes FROM organization_member WHERE user_id = ${developer.id}
        `),
        developerScopes,
      );
      assert.deepStrictEqual(
        await db.oneFirst(sql`
        SELECT scopes FROM organization_member WHERE user_id = ${noRoleUser.id}
        `),
        noRoleUserScopes,
      );

      // Run the remaining migrations
      await complete();

      // assert scopes
      assert.deepStrictEqual(
        await db.oneFirst(sql`
        SELECT scopes FROM organization_member WHERE user_id = ${developer.id}
        `),
        developerScopes.concat(['target:usage:write', 'target:usage:read']),
      );
      assert.deepStrictEqual(
        await db.oneFirst(sql`
        SELECT scopes FROM organization_member WHERE user_id = ${noRoleUser.id}
        `),
        noRoleUserScopes.concat(['target:usage:read']),
      );

      // assert assigned roles
      assert.deepStrictEqual(
        await db.oneFirst(sql`
        SELECT omr.scopes
        FROM organization_member as om
        LEFT JOIN organization_member_roles as omr ON omr.id = om.role_id
        WHERE om.user_id = ${developer.id} AND omr.organization_id = ${organization.id}
        `),
        developerScopes.concat(['target:usage:write', 'target:usage:read']),
      );
      // assert no role user has no role
      assert.strictEqual(
        await db.oneFirst(sql`
        SELECT role_id FROM organization_member WHERE user_id = ${noRoleUser.id}
        `),
        null,
      );
    } finally {
      await done();
      await storage.destroy();
    }
  });
});
