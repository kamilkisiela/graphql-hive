import assert from 'node:assert';
import { describe, test } from 'node:test';
import { z } from 'zod';
import { psql } from '@hive/postgres';
import { initMigrationTestingEnvironment } from './utils/testkit';

const BackfilledVersionModel = z.object({
  id: z.string(),
  is_composable: z.boolean(),
  graph_id: z.string(),
  graph_metadata: z.object({
    id: z.string(),
    name: z.string(),
    type: z.literal('contract'),
  }),
  source_schema_version_id: z.string(),
  diff_schema_version_id: z.string().nullable(),
});

await describe('migration: backfill-contract-schema-versions', async () => {
  await test('backfills the latest composable and non-composable versions of active contracts', async () => {
    const lockedTargetIds: string[] = [];
    const { db, runTo, complete, seed, done } = await initMigrationTestingEnvironment({
      async withRegistryLock(targetId, action) {
        lockedTargetIds.push(targetId);
        return action();
      },
    });

    try {
      await runTo('2026.09.24T00-00-01.schema-versions-action-id-nullability.ts');

      const user = await seed.user({ user: { name: 'u1', email: 'u1@test.com' } });
      const organization = await seed.organization({ organization: { name: 'org-1' }, user });
      const project = await seed.project({
        project: { name: 'p1', type: 'FEDERATION' },
        organization,
      });
      const target = await seed.target({ project, target: { name: 't1' } });

      const sourceVersionId = await db
        .oneFirst(
          psql`
          INSERT INTO schema_versions (is_composable, target_id)
          VALUES (true, ${target.id})
          RETURNING id
        `,
        )
        .then(z.string().parse);

      const contracts = await db
        .any(
          psql`
          INSERT INTO contracts (
            target_id,
            contract_name,
            remove_unreachable_types_from_public_api_schema,
            is_disabled
          ) VALUES
            (${target.id}, 'public', false, false),
            (${target.id}, 'disabled', false, true)
          RETURNING id, contract_name
        `,
        )
        .then(z.array(z.object({ id: z.string(), contract_name: z.string() })).parse);

      const activeContract = contracts.find(contract => contract.contract_name === 'public');
      const disabledContract = contracts.find(contract => contract.contract_name === 'disabled');
      assert.ok(activeContract);
      assert.ok(disabledContract);

      const activeVersions = await db
        .any(
          psql`
          INSERT INTO contract_versions (
            schema_version_id,
            contract_id,
            contract_name,
            schema_composition_errors,
            composite_schema_sdl,
            created_at
          ) VALUES
            (${sourceVersionId}, ${activeContract.id}, 'public', NULL, 'type Query { old: String }', '2026-01-01'),
            (${sourceVersionId}, ${activeContract.id}, 'public', NULL, 'type Query { current: String }', '2026-01-02'),
            (${sourceVersionId}, ${activeContract.id}, 'public', '[{"message":"broken"}]', NULL, '2026-01-03')
          RETURNING id, schema_composition_errors
        `,
        )
        .then(
          z.array(z.object({ id: z.string(), schema_composition_errors: z.unknown().nullable() }))
            .parse,
        );

      for (const [index, version] of activeVersions.entries()) {
        await db.query(psql`
          INSERT INTO contract_version_changes (
            contract_version_id,
            change_type,
            severity_level,
            meta,
            is_safe_based_on_usage
          ) VALUES (
            ${version.id},
            ${`CHANGE_${index}`},
            'BREAKING',
            ${psql.jsonb({ index })},
            false
          )
        `);
      }

      await db.query(psql`
        INSERT INTO contract_versions (
          schema_version_id,
          contract_id,
          contract_name,
          schema_composition_errors,
          created_at
        ) VALUES (
          ${sourceVersionId},
          ${disabledContract.id},
          'disabled',
          NULL,
          '2026-01-04'
        )
      `);

      await complete();

      assert.deepEqual(lockedTargetIds, [target.id]);

      const versions = await db
        .any(
          psql`
          SELECT
            id,
            is_composable,
            graph_id,
            graph_metadata,
            source_schema_version_id,
            diff_schema_version_id
          FROM schema_versions
          WHERE graph_id = ${activeContract.id}
          ORDER BY is_composable
        `,
        )
        .then(z.array(BackfilledVersionModel).parse);

      const expectedIds = activeVersions
        .filter((_, index) => index > 0)
        .map(version => version.id)
        .sort();

      assert.equal(versions.length, 2);
      assert.deepEqual(versions.map(version => version.id).sort(), expectedIds);
      assert.deepEqual(
        versions.map(version => version.is_composable),
        [false, true],
      );
      const latestInvalidVersion = versions.find(version => !version.is_composable);
      const latestValidVersion = versions.find(version => version.is_composable);
      assert.ok(latestInvalidVersion);
      assert.ok(latestValidVersion);
      assert.equal(latestInvalidVersion.diff_schema_version_id, latestValidVersion.id);
      assert.equal(latestValidVersion.diff_schema_version_id, null);
      assert.ok(
        versions.every(
          version =>
            version.graph_id === activeContract.id &&
            version.source_schema_version_id === sourceVersionId &&
            version.graph_metadata.id === activeContract.id &&
            version.graph_metadata.name === 'default/public',
        ),
      );

      const disabledVersionCount = await db
        .oneFirst(
          psql`
          SELECT count(*)::int
          FROM schema_versions
          WHERE graph_id = ${disabledContract.id}
        `,
        )
        .then(z.number().parse);
      assert.equal(disabledVersionCount, 0);

      const changes = await db
        .any(
          psql`
          SELECT schema_version_id, change_type, severity_level, meta, is_safe_based_on_usage
          FROM schema_version_changes
          WHERE schema_version_id = ANY(${psql.array(expectedIds, 'uuid')})
          ORDER BY change_type
        `,
        )
        .then(
          z.array(
            z.object({
              schema_version_id: z.string(),
              change_type: z.string(),
              severity_level: z.string(),
              meta: z.object({ index: z.number() }),
              is_safe_based_on_usage: z.boolean(),
            }),
          ).parse,
        );

      assert.deepEqual(
        changes.map(change => change.change_type),
        ['CHANGE_1', 'CHANGE_2'],
      );
      assert.ok(changes.every(change => change.severity_level === 'BREAKING'));
    } finally {
      await db.end().catch(() => {});
      await done();
    }
  });
});
