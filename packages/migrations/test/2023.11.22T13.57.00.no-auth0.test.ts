import assert from 'node:assert';
import { describe, test } from 'node:test';
import { sql } from 'slonik';
import { initMigrationTestingEnvironment } from './utils/testkit';

await describe('migration: no-auth0', async () => {
  await test('should work and not break things', async () => {
    const { db, runTo, complete, done, seed } = await initMigrationTestingEnvironment();

    try {
      // Run migrations all the way to the point before the one we are testing
      await runTo('2023.10.05T11.44.36.schema-checks-github-repository.ts');

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

      // Add non-supertokens user to organization
      await db.query(
        sql`INSERT INTO public.organization_member (user_id, organization_id, scopes) VALUES (${
          notSuperUser.id
        }, ${organization.id}, ${sql.array([], 'text')})`,
      );

      // Run the additional remaining migrations
      await complete();

      // Check that the organization (of non-supertokens user) is not deleted
      assert.equal(
        await db.oneFirst(
          sql`SELECT count(*) as total FROM public.organizations WHERE id = ${notSuperOrganization.id}`,
        ),
        0,
      );
      // Check that the organization (of supertokens user) is not deleted
      assert.equal(
        await db.oneFirst(
          sql`SELECT count(*) as total FROM public.organizations WHERE id = ${organization.id}`,
        ),
        1,
      );

      // Check that the project (of non-supertokens user) is deleted
      assert.equal(
        await db.oneFirst(
          sql`SELECT count() as total FROM public.projects WHERE id = ${notSuperProject.id}`,
        ),
        0,
      );
      // Check that the project (of supertokens user) is not deleted
      assert.equal(
        await db.oneFirst(
          sql`SELECT count() as total FROM public.projects WHERE id = ${project.id}`,
        ),
        1,
      );

      // Check that the membership is deleted
      assert.equal(
        await db.oneFirst(
          sql`SELECT count() as total FROM public.organization_member WHERE organization_id = ${organization.id} AND user_id = ${notSuperUser.id}`,
        ),
        0,
      );
    } finally {
      await done();
    }
  });
});
