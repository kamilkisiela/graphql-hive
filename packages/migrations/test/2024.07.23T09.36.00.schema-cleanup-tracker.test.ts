import assert from 'node:assert';
import { describe, test } from 'node:test';
import { sql } from 'slonik';
import { createStorage } from '../../services/storage/src/index';
import { initMigrationTestingEnvironment } from './utils/testkit';

await describe('migration: schema-cleanup-tracker', async () => {
  await test('schema coordinates backfill', async () => {
    const { db, runTo, complete, done, seed, connectionString } =
      await initMigrationTestingEnvironment();
    const storage = await createStorage(connectionString, 1);
    try {
      // Run migrations all the way to the point before the one we are testing
      await runTo('2024.07.17T00-00-00.app-deployments.ts');

      // Seed the database with some data (schema_sdl, supergraph_sdl, composite_schema_sdl)
      const admin = await seed.user({
        user: {
          name: 'test1',
          email: 'test1@test.com',
        },
      });

      const organization = await seed.organization({
        organization: {
          name: 'org-1',
        },
        user: admin,
      });

      const project = await seed.project({
        project: {
          name: 'project-1',
          type: 'SINGLE',
        },
        organization,
      });

      const target = await seed.target({
        target: {
          name: 'target-1',
        },
        project,
      });

      async function createVersion(
        schema: string,
        previousSchemaVersionId: string | null,
      ): Promise<string> {
        const logId = await db.oneFirst<string>(sql`
          INSERT INTO schema_log
            (
              author,
              service_name,
              service_url,
              commit,
              sdl,
              project_id,
              target_id,
              metadata,
              action
            )
          VALUES
            (
              ${'Kamil'},
              ${null},
              ${null},
              ${'random'},
              ${schema},
              ${project.id},
              ${target.id},
              ${null},
              'PUSH'
            )
          RETURNING id
        `);

        const versionId = await db.oneFirst<string>(sql`
          INSERT INTO schema_versions
          (
            record_version,
            is_composable,
            target_id,
            action_id,
            base_schema,
            has_persisted_schema_changes,
            previous_schema_version_id,
            diff_schema_version_id,
            composite_schema_sdl,
            supergraph_sdl,
            schema_composition_errors,
            github_repository,
            github_sha,
            tags,
            has_contract_composition_errors,
            conditional_breaking_change_metadata
          )
          VALUES
          (
            '2024-01-10',
            ${true},
            ${target.id},
            ${logId},
            ${null},
            ${true},
            ${previousSchemaVersionId},
            ${previousSchemaVersionId},
            ${schema},
            ${null},
            ${null},
            ${null},
            ${null},
            ${null},
            ${false},
            ${null}
          )
          RETURNING id
        `);

        return versionId;
      }

      const schemas = [
        // [0]
        // first
        /* GraphQL */ `
          type Query {
            hello: String
          }
        `,
        // [1]
        // second
        /* GraphQL */ `
          type Query {
            hello: String
            hi: String
          }
        `,
        // [2]
        // third
        /* GraphQL */ `
          type Query {
            hello: String
          }
        `,
        // [3]
        // fourth
        /* GraphQL */ `
          type Query {
            hello: String
            hi: String
          }
        `,
        // [4]
        // fifth
        /* GraphQL */ `
          type Query {
            hello: String @deprecated(reason: "no longer needed")
            bye: String
            goodbye: String
            hi: String @deprecated(reason: "no longer needed")
          }
        `,
        // [5]
        // sixth
        /* GraphQL */ `
          type Query {
            hello: String
            bye: String
            hi: String @deprecated(reason: "no longer needed")
          }
        `,
      ];

      // insert schema versions
      let previousSchemaVersionId: string | null = null;
      for await (const schema of schemas) {
        const versionId = await createVersion(schema, previousSchemaVersionId);
        previousSchemaVersionId = versionId;
      }

      // Run the remaining migrations
      await complete();

      // check that coordinates are correct

      const versions = await db.manyFirst<string>(sql`
        SELECT id FROM schema_versions WHERE target_id = ${target.id} ORDER BY created_at ASC
      `);

      const coordinates = await db.many<{
        coordinate: string;
        created_in_version_id: string;
        deprecated_in_version_id: string | null;
      }>(sql`
        SELECT * FROM schema_coordinate_status WHERE target_id = ${target.id}
      `);

      assert.strictEqual(versions.length, 6);

      const queryType = coordinates.find(c => c.coordinate === 'Query');
      const helloField = coordinates.find(c => c.coordinate === 'Query.hello');
      const hiField = coordinates.find(c => c.coordinate === 'Query.hi');
      const byeField = coordinates.find(c => c.coordinate === 'Query.bye');
      const goodbyeField = coordinates.find(c => c.coordinate === 'Query.goodbye');

      assert.ok(queryType, 'Query type not found');
      assert.ok(helloField, 'Query.hello field not found');
      assert.ok(hiField, 'Query.hi field not found');
      assert.ok(byeField, 'Query.bye field not found');

      // Query
      // was create in the first version
      // never deprecated
      assert.strictEqual(queryType.created_in_version_id, versions[0]);
      assert.strictEqual(queryType.deprecated_in_version_id, null);

      // Query.hello
      // was created in the first version,
      // deprecated in fifth
      // undeprecated in the sixth
      assert.strictEqual(helloField.created_in_version_id, versions[0]);
      assert.strictEqual(helloField.deprecated_in_version_id, null);

      // Query.hi
      // was created in the second version
      // removed in the third
      // added back in the fourth
      // deprecated in the fifth
      assert.strictEqual(hiField.created_in_version_id, versions[3]);
      assert.strictEqual(hiField.deprecated_in_version_id, versions[4]);

      // Query.bye
      // was created in the fifth version
      assert.strictEqual(byeField.created_in_version_id, versions[4]);

      // Query.goodbye
      // was created in the fifth version
      // removed in the sixth
      assert.ok(!goodbyeField, 'Query.goodbye field should not be found');
    } finally {
      await done();
      await storage.destroy();
    }
  });
});
