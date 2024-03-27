import assert from 'node:assert';
import { describe, test } from 'node:test';
import { sql } from 'slonik';
import { initMigrationTestingEnvironment } from './utils/testkit';

await describe('organization-target-ids-log', async () => {
  await test('should add existing target ids to target_ids_log column', async () => {
    const { db, runTo, complete, done, seed } = await initMigrationTestingEnvironment();

    try {
      // Run migrations all the way to the point before the one we are testing
      await runTo('2024.02.19T00.00.01.schema-check-store-breaking-change-metadata.ts');

      const user = await seed.user({
        user: {
          name: 'user-1',
          email: 'user-1@test.com',
        },
      });
      const org1 = await seed.organization({
        user,
        organization: {
          name: 'org-1',
        },
      });

      const org2 = await seed.organization({
        user,
        organization: {
          name: 'org-2',
        },
      });

      const project1 = await seed.project({
        organization: org1,
        project: {
          name: 'proj-1',
          type: 'SINGLE',
        },
      });
      const target1 = await seed.target({
        project: project1,
        target: {
          name: 'target-1',
        },
      });
      const target11 = await seed.target({
        project: project1,
        target: {
          name: 'target-11',
        },
      });

      const project2 = await seed.project({
        organization: org1,
        project: {
          name: 'proj-2',
          type: 'SINGLE',
        },
      });
      const target2 = await seed.target({
        project: project1,
        target: {
          name: 'target-1',
        },
      });

      const project3 = await seed.project({
        organization: org2,
        project: {
          name: 'proj-3',
          type: 'SINGLE',
        },
      });

      const target3 = await seed.target({
        project: project3,
        target: {
          name: 'target-1',
        },
      });

      const org1Targets = [target1.id, target11.id, target2.id];
      const org2Targets = [target3.id];

      // Run the additional remaining migrations
      await complete();

      const org1TargetIdsLog = await db.oneFirst<string[]>(
        sql`SELECT target_ids_log FROM organizations WHERE id = ${org1.id}`,
      );
      const org2TargetIdsLog = await db.oneFirst<string[]>(
        sql`SELECT target_ids_log FROM organizations WHERE id = ${org2.id}`,
      );

      assert.deepStrictEqual(org1TargetIdsLog.sort(), org1Targets.sort());
      assert.deepStrictEqual(org2TargetIdsLog.sort(), org2Targets.sort());
    } finally {
      await done();
    }
  });
});
