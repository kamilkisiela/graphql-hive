import assert from 'node:assert';
import { describe, test } from 'node:test';
import { DatabasePool, sql } from 'slonik';
import { createStorage } from '../../services/storage/src/index';
import { initMigrationTestingEnvironment } from './utils/testkit';

async function insertSchemaCheck(
  pool: DatabasePool,
  args: {
    targetId: string;
    schemaVersionId: string;
    schemaSDL: string;
    compositeSchemaSDL: string;
    supergraphSDL: string;
  },
) {
  return pool.one<{ id: string }>(sql`
    INSERT INTO "public"."schema_checks" (
        "schema_sdl"
      , "target_id"
      , "schema_version_id"
      , "is_success"
      , "composite_schema_sdl"
      , "supergraph_sdl"
      , "is_manually_approved"
    )
    VALUES (
        ${args.schemaSDL}
      , ${args.targetId}
      , ${args.schemaVersionId}
      , ${true}
      , ${args.compositeSchemaSDL}
      , ${args.supergraphSDL}
      , ${false}
    )
    RETURNING id
  `);
}

await describe('migration: schema-checks-dedup', async () => {
  await test('should incrementally adopt sdl_store without corrupting existing and new data', async () => {
    const { db, runTo, complete, done, seed, connectionString } =
      await initMigrationTestingEnvironment();
    const storage = await createStorage(connectionString, 1);
    try {
      // Run migrations all the way to the point before the one we are testing
      await runTo('2023.08.03T11.44.36.schema-checks-github-repository.ts');

      // Seed the database with some data (schema_sdl, supergraph_sdl, composite_schema_sdl)
      const user = await seed.user();
      const organization = await db.one<{
        id: string;
      }>(
        sql`INSERT INTO public.organizations (clean_id, name, user_id) VALUES ('org-1', 'org-1', ${user.id}) RETURNING id;`,
      );
      const project = await db.one<{
        id: string;
      }>(
        sql`INSERT INTO public.projects (clean_id, name, type, org_id) VALUES ('proj-1', 'proj-1', 'SINGLE', ${organization.id}) RETURNING id;`,
      );
      const target = await db.one<{
        id: string;
      }>(
        sql`INSERT INTO public.targets (clean_id, name, project_id) VALUES ('proj-1', 'proj-1', ${project.id}) RETURNING id;`,
      );

      const compositeSchemaSDL = `composite schema 1`;
      const schemaSDL = `schema 1`;
      const supergraphSDL = `supergraph 1`;

      const secondCompositeSchemaSDL = `composite schema 2`;
      const secondSchemaSDL = `schema 2`;
      const secondSupergraphSDL = `supergraph 2`;

      const action = await db.one<{
        id: string;
      }>(
        sql`
          INSERT INTO public.schema_log
              (
                author,
                commit,
                sdl,
                project_id,
                target_id,
                action
              )
            VALUES
              (
                ${'Author 1'},
                ${'commit 1'}::text,
                ${compositeSchemaSDL}::text,
                ${project.id},
                ${target.id},
                'PUSH'
              )
            RETURNING id
        `,
      );

      const version = await db.one<{
        id: string;
      }>(
        sql`
        INSERT INTO public.schema_versions
        (
          is_composable,
          target_id,
          action_id,
          has_persisted_schema_changes,
          composite_schema_sdl,
          supergraph_sdl
        )
      VALUES
        (
          ${true},
          ${target.id},
          ${action.id},
          ${false},
          ${compositeSchemaSDL},
          ${supergraphSDL}
        )
        RETURNING id
        `,
      );

      const firstSchemaCheck = await insertSchemaCheck(db, {
        targetId: target.id,
        schemaVersionId: version.id,
        schemaSDL,
        compositeSchemaSDL,
        supergraphSDL,
      });

      const secondSchemaCheck = await insertSchemaCheck(db, {
        targetId: target.id,
        schemaVersionId: version.id,
        schemaSDL: secondSchemaSDL,
        compositeSchemaSDL: secondCompositeSchemaSDL,
        supergraphSDL: secondSupergraphSDL,
      });

      const thirdSchemaCheck = await insertSchemaCheck(db, {
        targetId: target.id,
        schemaVersionId: version.id,
        schemaSDL,
        compositeSchemaSDL,
        supergraphSDL,
      });

      // Run the additional remaining migrations
      await complete();

      const newSchemaCheckHashes = {
        schemaSDLHash: 'schemaSDLHash', // serve exact same schema from different hash to make sure it's allowed
        compositeSchemaSDLHash: 'compositeSchemaSDLHash',
        supergraphSDLHash: 'supergraphSDLHash',
      };
      const newSchemaCheck: {
        id: string;
      } = await storage.createSchemaCheck({
        targetId: target.id,
        schemaVersionId: version.id,
        isSuccess: true,
        isManuallyApproved: false,
        schemaSDL,
        schemaSDLHash: newSchemaCheckHashes.schemaSDLHash, // serve exact same schema from different hash to make sure it's allowed
        compositeSchemaSDL,
        compositeSchemaSDLHash: newSchemaCheckHashes.compositeSchemaSDLHash,
        supergraphSDL,
        supergraphSDLHash: newSchemaCheckHashes.supergraphSDLHash,
        serviceName: null,
        manualApprovalUserId: null,
        githubCheckRunId: null,
        githubRepository: null,
        githubSha: null,
        meta: null,
        schemaCompositionErrors: null,
        breakingSchemaChanges: null,
        safeSchemaChanges: null,
        schemaPolicyWarnings: null,
        schemaPolicyErrors: null,
        expiresAt: null,
      });

      // make sure SQL statements from Storage are capable of serving SDLs directly from schema_checks
      const firstCheckFromStorage = await storage.findSchemaCheck({
        schemaCheckId: firstSchemaCheck.id,
        targetId: target.id,
      });
      assert.strictEqual(firstCheckFromStorage?.schemaSDL, schemaSDL);
      assert.strictEqual(firstCheckFromStorage?.compositeSchemaSDL, compositeSchemaSDL);
      assert.strictEqual(firstCheckFromStorage?.supergraphSDL, supergraphSDL);
      const secondCheckFromStorage = await storage.findSchemaCheck({
        schemaCheckId: secondSchemaCheck.id,
        targetId: target.id,
      });
      assert.strictEqual(secondCheckFromStorage?.schemaSDL, secondSchemaSDL);
      assert.strictEqual(secondCheckFromStorage?.compositeSchemaSDL, secondCompositeSchemaSDL);
      assert.strictEqual(secondCheckFromStorage?.supergraphSDL, secondSupergraphSDL);
      const thirdCheckFromStorage = await storage.findSchemaCheck({
        schemaCheckId: thirdSchemaCheck.id,
        targetId: target.id,
      });
      assert.strictEqual(thirdCheckFromStorage?.schemaSDL, schemaSDL);
      assert.strictEqual(thirdCheckFromStorage?.compositeSchemaSDL, compositeSchemaSDL);
      assert.strictEqual(thirdCheckFromStorage?.supergraphSDL, supergraphSDL);

      // make sure SQL statements from Storage are capable of serving SDLs from sdl_store
      const newCheckFromStorage = await storage.findSchemaCheck({
        schemaCheckId: newSchemaCheck.id,
        targetId: target.id,
      });
      assert.strictEqual(newCheckFromStorage?.schemaSDL, schemaSDL);
      assert.strictEqual(newCheckFromStorage?.compositeSchemaSDL, compositeSchemaSDL);
      assert.strictEqual(newCheckFromStorage?.supergraphSDL, supergraphSDL);

      // make sure SDLs in schema_checks are null for new schema checks
      const schemaChecksWithAllNulls = await db.oneFirst<number>(sql`
        SELECT count(*) as total FROM schema_checks
        WHERE 
          schema_sdl IS NULL
          AND composite_schema_sdl IS NULL
          AND supergraph_sdl IS NULL
      `);
      assert.strictEqual(
        schemaChecksWithAllNulls,
        1,
        'only the new schema check should have nulls instead of SDLs',
      );

      let countSdlStore = await db.oneFirst<number>(sql`SELECT count(*) as total FROM sdl_store`);
      assert.strictEqual(
        countSdlStore,
        3 /* 3 unique SDLs, only those from the newly created schema check */,
      );

      // Drop the newSchemaCheck
      let countSchemaChecks = await db.oneFirst<number>(
        sql`SELECT count(*) as total FROM schema_checks`,
      );
      assert.strictEqual(countSchemaChecks, 4);
      const expiresAt = new Date();
      await db.query(sql`
        UPDATE
          schema_checks
        SET
          expires_at = ${expiresAt.toISOString()}
        WHERE
          id = ${newSchemaCheck.id}
      `);

      // Purge unused SDLs from sdl_store
      const result = await storage.purgeExpiredSchemaChecks({
        expiresAt,
      });

      assert.strictEqual(result.deletedSchemaCheckCount, 1);
      assert.strictEqual(result.deletedSdlStoreCount, 3);

      countSchemaChecks = await db.oneFirst<number>(
        sql`SELECT count(*) as total FROM schema_checks`,
      );
      assert.strictEqual(countSchemaChecks, 3);

      countSdlStore = await db.oneFirst<number>(sql`
        SELECT count(*) as total FROM sdl_store WHERE
             id = ${newSchemaCheckHashes.schemaSDLHash}
          OR id = ${newSchemaCheckHashes.compositeSchemaSDLHash}
          OR id = ${newSchemaCheckHashes.supergraphSDLHash}
      `);
      assert.strictEqual(countSdlStore, 0, 'all SDLs from the new schema check should be purged');
    } finally {
      await done();
      await storage.destroy();
    }
  });
});
