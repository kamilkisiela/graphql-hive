import assert from 'node:assert';
import { describe, test } from 'node:test';
import { sql } from 'slonik';
import { initMigrationTestingEnvironment } from './utils/testkit';

await describe('migration: no-auth0', async () => {
  await test('should work and not break things', async () => {
    const { db, runTo, complete, done, seed } = await initMigrationTestingEnvironment();

    try {
      // Run migrations all the way to the point before the one we are testing
      await runTo('2023.11.09T00.00.00.schema-check-approval.ts');

      // Seed the DB with orgs
      const notSuperUser = await seed.user({
        email: 'test2@mail.com',
        display_name: 'test2',
        full_name: 'test2',
        // no supertoken_user_id
      });
      const user = await seed.user({
        email: 'test2@mail.com',
        display_name: 'test2',
        full_name: 'test2',
        supertoken_user_id: '2',
      });
      const anotherUser = await seed.user({
        email: 'test3@mail.com',
        display_name: 'test3',
        full_name: 'test3',
        supertoken_user_id: '3',
      });
      const notSuperOrganization = await seed.organization({
        user: notSuperUser,
        organization: {
          name: 'org-1',
          cleanId: 'org-1',
        },
      });
      const organization = await seed.organization({
        user: user,
        organization: {
          name: 'org-2',
          cleanId: 'org-2',
        },
      });
      const notSuperProject = await seed.project({
        organization: notSuperOrganization,
        project: {
          name: 'proj-1',
          cleanId: 'proj-1',
          type: 'SINGLE',
        },
      });
      const project = await seed.project({
        organization: organization,
        project: {
          name: 'proj-2',
          cleanId: 'proj-2',
          type: 'SINGLE',
        },
      });

      // TODO: check the last activity of organizations of non-supertokens owners
      // TODO: delete organizations of non-supertokens accounts only if members are also non-supertokens

      // organization -> user and non-supertokens user
      // non-supertokens organization -> non-supertokens user and another user
      await db.query(
        sql`
          INSERT INTO public.organization_member (user_id, organization_id, scopes)
          VALUES
          (${user.id}, ${organization.id}, ${sql.array([], 'text')}),
          (${notSuperUser.id}, ${organization.id}, ${sql.array([], 'text')}),
          (${notSuperUser.id}, ${notSuperOrganization.id}, ${sql.array([], 'text')}),
          (${anotherUser.id}, ${notSuperOrganization.id}, ${sql.array([], 'text')})
        `,
      );

      // Run the additional remaining migrations
      await complete();

      // The organization of non-supertokens user is deleted
      assert.equal(
        await db.oneFirst(
          sql`SELECT count(*) as total FROM public.organizations WHERE id = ${notSuperOrganization.id}`,
        ),
        0,
      );
      // The organization of supertokens user is not deleted
      assert.equal(
        await db.oneFirst(
          sql`SELECT count(*) as total FROM public.organizations WHERE id = ${organization.id}`,
        ),
        1,
      );

      // The project of non-supertokens user is deleted
      assert.equal(
        await db.oneFirst(
          sql`SELECT count(*) as total FROM public.projects WHERE id = ${notSuperProject.id}`,
        ),
        0,
      );
      // The project of supertokens user is not deleted
      assert.equal(
        await db.oneFirst(
          sql`SELECT count(*) as total FROM public.projects WHERE id = ${project.id}`,
        ),
        1,
      );

      // non-supertokens user is delete from supertokens organization
      assert.equal(
        await db.oneFirst(
          sql`SELECT count(*) as total FROM public.organization_member WHERE organization_id = ${organization.id} AND user_id = ${notSuperUser.id}`,
        ),
        0,
      );
      // supertokens user is NOT delete from supertokens organization
      assert.equal(
        await db.oneFirst(
          sql`SELECT count(*) as total FROM public.organization_member WHERE organization_id = ${organization.id} AND user_id = ${user.id}`,
        ),
        1,
      );
      // supertokens and non-supertokens users are delete from non-supertokens organization
      assert.equal(
        await db.oneFirst(
          sql`SELECT count(*) as total FROM public.organization_member WHERE organization_id = ${notSuperOrganization.id}`,
        ),
        0,
      );
    } finally {
      await done();
    }
  });
});
