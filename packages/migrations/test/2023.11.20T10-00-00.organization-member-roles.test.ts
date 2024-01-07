import assert from 'node:assert';
import { describe, test } from 'node:test';
import { ForeignKeyIntegrityConstraintViolationError, sql } from 'slonik';
import { createStorage } from '../../services/storage/src/index';
import { initMigrationTestingEnvironment } from './utils/testkit';

await describe('migration: organization-member-roles', async () => {
  await test('should incrementally adopt roles without corrupting existing and new data', async () => {
    const { db, runTo, done, seed, connectionString } = await initMigrationTestingEnvironment();
    const storage = await createStorage(connectionString, 1);
    try {
      // Run migrations all the way to the point before the one we are testing
      await runTo('2023.10.25T14.41.41.schema-checks-dedup.ts');

      // Seed the database with some data (schema_sdl, supergraph_sdl, composite_schema_sdl)
      const admin = await seed.user({
        user: {
          name: 'test1',
          email: 'test1@test.com',
        },
      });
      const contributor = await seed.user({
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
      const secondaryAdmin = await seed.user({
        user: {
          name: 'test3',
          email: 'test3@test.com',
        },
      });
      const secondaryOrganization = await seed.organization({
        organization: {
          name: 'org-2',
        },
        user: secondaryAdmin,
      });

      const adminScopes = [
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
        'target:tokens:write',
      ];
      const contributorScopes = [
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
      ];

      // Create an invitation to simulate a pending invitation
      await db.query(sql`
        INSERT INTO organization_invitations (organization_id, email) VALUES (${organization.id}, 'invited@test.com')
      `);

      await db.query(sql`
        INSERT INTO organization_member (organization_id, user_id, scopes)
        VALUES
          (${organization.id}, ${admin.id}, ${sql.array(adminScopes, 'text')}),
          (${organization.id}, ${contributor.id}, ${sql.array(contributorScopes, 'text')}),
          (${organization.id}, ${noRoleUser.id}, ${sql.array(noRoleUserScopes, 'text')}),
          (${secondaryOrganization.id}, ${secondaryAdmin.id}, ${sql.array(adminScopes, 'text')})
      `);

      // assert correct scopes
      assert.deepStrictEqual(
        await db.oneFirst(sql`
        SELECT scopes FROM organization_member WHERE user_id = ${admin.id}
        `),
        adminScopes,
      );
      assert.deepStrictEqual(
        await db.oneFirst(sql`
        SELECT scopes FROM organization_member WHERE user_id = ${contributor.id}
        `),
        contributorScopes,
      );
      assert.deepStrictEqual(
        await db.oneFirst(sql`
        SELECT scopes FROM organization_member WHERE user_id = ${noRoleUser.id}
        `),
        noRoleUserScopes,
      );
      assert.deepStrictEqual(
        await db.oneFirst(sql`
        SELECT scopes FROM organization_member WHERE user_id = ${secondaryAdmin.id}
        `),
        adminScopes,
      );

      // Run the remaining migrations
      await runTo('2023.11.20T10-00-00.organization-member-roles.ts');

      // assert scopes are still in place and identical
      assert.deepStrictEqual(
        await db.oneFirst(sql`
        SELECT scopes FROM organization_member WHERE user_id = ${admin.id}
        `),
        adminScopes,
      );
      assert.deepStrictEqual(
        await db.oneFirst(sql`
        SELECT scopes FROM organization_member WHERE user_id = ${contributor.id}
        `),
        contributorScopes,
      );
      assert.deepStrictEqual(
        await db.oneFirst(sql`
        SELECT scopes FROM organization_member WHERE user_id = ${noRoleUser.id}
        `),
        noRoleUserScopes,
      );
      assert.deepStrictEqual(
        await db.oneFirst(sql`
        SELECT scopes FROM organization_member WHERE user_id = ${secondaryAdmin.id}
        `),
        adminScopes,
      );

      // assert assigned roles have identical scopes
      assert.deepStrictEqual(
        await db.oneFirst(sql`
        SELECT omr.scopes
        FROM organization_member as om
        LEFT JOIN organization_member_roles as omr ON omr.id = om.role_id
        WHERE om.user_id = ${admin.id} AND omr.organization_id = ${organization.id}
        `),
        adminScopes,
      );
      assert.deepStrictEqual(
        await db.oneFirst(sql`
        SELECT omr.scopes
        FROM organization_member as om
        LEFT JOIN organization_member_roles as omr ON omr.id = om.role_id
        WHERE om.user_id = ${contributor.id} AND omr.organization_id = ${organization.id}
        `),
        contributorScopes,
      );
      // assert no role user has no role
      assert.strictEqual(
        await db.oneFirst(sql`
        SELECT role_id FROM organization_member WHERE user_id = ${noRoleUser.id}
        `),
        null,
      );
      assert.deepStrictEqual(
        await db.oneFirst(sql`
        SELECT omr.scopes
        FROM organization_member as om
        LEFT JOIN organization_member_roles as omr ON omr.id = om.role_id
        WHERE om.user_id = ${secondaryAdmin.id} AND omr.organization_id = ${secondaryOrganization.id}
        `),
        adminScopes,
      );

      // deleting a role with assigned members should not be possible
      const deletionError = await db
        .query(
          sql`
          DELETE FROM organization_member_roles WHERE organization_id = ${organization.id} AND id IN (
            SELECT role_id FROM organization_member WHERE organization_id = ${organization.id} AND user_id = ${contributor.id}
          )
      `,
        )
        .catch(error => Promise.resolve(error));
      assert.strictEqual(
        deletionError instanceof ForeignKeyIntegrityConstraintViolationError,
        true,
      );

      // locked roles should be Viewer and Admin
      assert.deepStrictEqual(
        await db.manyFirst(sql`
          SELECT name FROM organization_member_roles WHERE organization_id = ${organization.id} AND locked = true ORDER BY name ASC
        `),
        ['Admin', 'Viewer'],
      );

      // deleting a member should not delete the role
      const contributorRoleId = await db.oneFirst<string>(sql`
        SELECT role_id FROM organization_member WHERE organization_id = ${organization.id} AND user_id = ${contributor.id}
      `);
      assert.strictEqual(
        await db.oneFirst(sql`
          DELETE FROM organization_member WHERE user_id = ${contributor.id} AND organization_id = ${organization.id} RETURNING user_id
        `),
        contributor.id,
      );
      assert.strictEqual(
        await db.oneFirst(sql`
          SELECT id FROM organization_member_roles WHERE organization_id = ${organization.id} AND id = ${contributorRoleId}
        `),
        contributorRoleId,
      );

      // deleting a user should not delete the role
      const customRoleId = await db.oneFirst<string>(sql`
        INSERT INTO organization_member_roles
        (organization_id, name, description, scopes)
        VALUES
        (${organization.id}, 'Custom', 'Custom role', ${sql.array(noRoleUserScopes, 'text')})
        RETURNING id
      `);
      await db.query(sql`
        UPDATE organization_member SET role_id = ${customRoleId} WHERE user_id = ${noRoleUser.id} AND organization_id = ${organization.id}
      `);
      assert.strictEqual(
        await db.oneFirst(sql`
          DELETE FROM users WHERE id = ${noRoleUser.id} RETURNING id
        `),
        noRoleUser.id,
      );
      assert.strictEqual(
        await db.oneFirst(sql`
          SELECT id FROM organization_member_roles WHERE organization_id = ${organization.id} AND id = ${customRoleId}
        `),
        customRoleId,
      );

      // pending invitations should have Viewer role
      assert.deepStrictEqual(
        await db.manyFirst(sql`
          SELECT omr.name
          FROM organization_invitations as oi
          LEFT JOIN organization_member_roles as omr ON (omr.id = oi.role_id AND omr.organization_id = oi.organization_id)
          WHERE oi.organization_id = ${organization.id}
        `),
        ['Viewer'],
      );
    } finally {
      await done();
      await storage.destroy();
    }
  });
});
