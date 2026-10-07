import { z } from 'zod';
import { psql, type CommonQueryMethods } from '@hive/postgres';
import { type MigrationExecutor } from '../pg-migrator';

const ContractModel = z.object({
  id: z.string(),
  targetId: z.string(),
  graphName: z.string(),
});

const TargetModel = z.object({
  id: z.string(),
});

async function getContractGraphsForTargetId(trx: CommonQueryMethods, targetId: string) {
  return await trx
    .any(
      psql`
        SELECT
          "graphs"."id"
          , "graphs"."target_id" AS "targetId"
          , "graphs"."name" AS "graphName"
        FROM "graphs"
        WHERE
          "graphs"."target_id" = ${targetId}
          AND "graphs"."type" = 'CONTRACT'
      `,
    )
    .then(z.array(ContractModel).parse);
}

async function insertSchemaChanges(trx: CommonQueryMethods, schemaVersionId: string) {
  await trx.query(psql`
    INSERT INTO "schema_version_changes" (
      "schema_version_id"
      , "change_type"
      , "severity_level"
      , "meta"
      , "is_safe_based_on_usage"
    )
    SELECT
      ${schemaVersionId}
      , "contract_version_changes"."change_type"
      , "contract_version_changes"."severity_level"
      , "contract_version_changes"."meta"
      , "contract_version_changes"."is_safe_based_on_usage"
    FROM
      "contract_version_changes"
    WHERE
      "contract_version_changes"."contract_version_id" = ${schemaVersionId}
  `);
}

async function insertLatestSchemaVersionForContract(
  trx: CommonQueryMethods,
  contract: z.TypeOf<typeof ContractModel>,
) {
  await trx.transaction('insert latest version', async trx => {
    const latestVersionId = await trx
      .maybeOneFirst(
        psql`
      INSERT INTO "schema_versions" (
        "id"
        , "created_at"
        , "record_version"
        , "is_composable"
        , "target_id"
        , "has_persisted_schema_changes"
        , "composite_schema_sdl"
        , "supergraph_sdl"
        , "schema_composition_errors"
        , "has_contract_composition_errors"
        , "graph_id"
        , "graph_metadata"
        , "source_schema_version_id"
      )
      SELECT
        "contract_versions"."id"
        , "contract_versions"."created_at"
        , '2024-01-10'
        , "contract_versions"."schema_composition_errors" IS NULL
        , ${contract.targetId}
        , true
        , "contract_versions"."composite_schema_sdl"
        , "contract_versions"."supergraph_sdl"
        , "contract_versions"."schema_composition_errors"
        , false
        , ${contract.id}
        , jsonb_build_object(
            'id', ${contract.id}::text
            , 'name', ${contract.graphName}::text
            , 'type', 'contract'
          )
        , "contract_versions"."schema_version_id"
      FROM "contract_versions"
      WHERE "contract_versions"."contract_id" = ${contract.id}
      ORDER BY "contract_versions"."created_at" DESC, "contract_versions"."id" DESC
      LIMIT 1
      ON CONFLICT ("id") DO NOTHING
      RETURNING "id"
    `,
      )
      .then(z.string().nullable().parse);

    if (!latestVersionId) {
      return;
    }

    await insertSchemaChanges(trx, latestVersionId);
  });
}

async function insertLatestValidSchemaVersionForContract(
  trx: CommonQueryMethods,
  contract: z.TypeOf<typeof ContractModel>,
): Promise<boolean> {
  return await trx.transaction('latest valid version', async trx => {
    const latestComposableVersionId = await trx.maybeOneFirst(psql`
      INSERT INTO "schema_versions" (
        "id"
        , "created_at"
        , "record_version"
        , "is_composable"
        , "target_id"
        , "has_persisted_schema_changes"
        , "composite_schema_sdl"
        , "supergraph_sdl"
        , "schema_composition_errors"
        , "has_contract_composition_errors"
        , "graph_id"
        , "graph_metadata"
        , "source_schema_version_id"
      )
      SELECT
        "contract_versions"."id"
        , "contract_versions"."created_at"
        , '2024-01-10'
        , true
        , ${contract.targetId}
        , true
        , "contract_versions"."composite_schema_sdl"
        , "contract_versions"."supergraph_sdl"
        , NULL
        , false
        , ${contract.id}
        , jsonb_build_object(
           'id', ${contract.id}::text
           , 'name', ${contract.graphName}::text
           , 'type', 'contract'
        )
        , "contract_versions"."schema_version_id"
      FROM "contract_versions"
      WHERE
        "contract_versions"."contract_id" = ${contract.id}
        AND "contract_versions"."schema_composition_errors" IS NULL
      ORDER BY
        "contract_versions"."created_at" DESC
        , "contract_versions"."id" DESC
      LIMIT 1
      ON CONFLICT ("id") DO NOTHING
      RETURNING
        "id"
    `);

    if (!latestComposableVersionId) {
      return false;
    }

    await insertSchemaChanges(trx, latestComposableVersionId);

    return true;
  });
}

export default {
  name: '2026.10.09T00-00-01.backfill-contract-schema-versions.ts',
  noTransaction: true,
  async run({ connection, withRegistryLock }) {
    const targets = await connection
      .any(
        psql`
          SELECT "targets"."id"
          FROM "targets"
          ORDER BY "targets"."id"
      `,
      )
      .then(z.array(TargetModel).parse);

    for (const target of targets) {
      await withRegistryLock(target.id, async () => {
        const contractGraphs = await getContractGraphsForTargetId(connection, target.id);

        for (const contract of contractGraphs) {
          await connection.transaction('insert latest schema versions', async trx => {
            const didInsertLatestValidVersion = await insertLatestValidSchemaVersionForContract(
              connection,
              contract,
            );

            if (!didInsertLatestValidVersion) {
              // in this case there is no "latest" version
              return;
            }

            await insertLatestSchemaVersionForContract(connection, contract);
          });
        }
      });
    }
  },
} satisfies MigrationExecutor;
