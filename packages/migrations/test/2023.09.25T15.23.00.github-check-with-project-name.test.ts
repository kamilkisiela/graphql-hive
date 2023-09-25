import assert from 'node:assert';
import { describe, test } from 'node:test';
import { sql } from 'slonik';
import { initMigrationTestingEnvironment } from './utils/testkit';

describe('migration: github-check-with-project-name', async () => {
  await test('should use FALSE for existing projects and TRUE for new', async () => {
    const { db, runTo, complete, done, seed } = await initMigrationTestingEnvironment();

    try {
      // Run migrations all the way to the point before the one we are testing
      await runTo('2023.09.01T09.54.00.zendesk-support.ts');

      // Seed the DB with orgs
      const user = await seed.user();
      const org = await db.one<{
        id: string;
      }>(
        sql`INSERT INTO public.organizations (clean_id, name, user_id, type) VALUES ('org-1', 'org-1', ${user.id}, 'REGULAR') RETURNING id;`,
      );
      const oldProject = await db.one(
        sql`INSERT INTO public.projects (clean_id, name, type, org_id) VALUES ('proj-1', 'proj-1', 'SINGLE', ${org.id}) RETURNING id;`,
      );

      // Run the additional remaining migrations
      await complete();

      const newProject = await db.one(
        sql`INSERT INTO public.projects (clean_id, name, type, org_id) VALUES ('proj-2', 'proj-2', 'SINGLE', ${org.id}) RETURNING id;`,
      );

      // Check that the old project has github_check_with_project_name = FALSE
      assert.equal(
        await db.oneFirst(
          sql`SELECT github_check_with_project_name FROM public.projects WHERE id = ${oldProject.id}`,
        ),
        false,
      );

      // Check that the new project has github_check_with_project_name = TRUE
      assert.equal(
        await db.oneFirst(
          sql`SELECT github_check_with_project_name FROM public.projects WHERE id = ${newProject.id}`,
        ),
        true,
      );
    } finally {
      await done();
    }
  });
});
