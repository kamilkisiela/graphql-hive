import { z } from 'zod';
import { type MigrationExecutor } from '../pg-migrator';

const ActiveContractModel = z.object({
  id: z.string(),
  targetId: z.string(),
  graphName: z.string(),
});

export default {
  name: '2026.10.09T00-00-01.backfill-contract-schema-versions.ts',
  noTransaction: true,
  async run({ psql, connection }) {
    const contracts = await connection
      .any(
        psql`
        SELECT
          "contracts"."id"
          , "contracts"."target_id" AS "targetId"
          , "graphs"."name" AS "graphName"
        FROM "contracts"
        INNER JOIN "graphs"
          ON "graphs"."id" = "contracts"."id"
          AND "graphs"."type" = 'CONTRACT'
        WHERE "contracts"."is_disabled" = false
      `,
      )
      .then(z.array(ActiveContractModel).parse);

    for (const contract of contracts) {
      await connection.transaction('latest version', async trx => {
        const latestVersionId = await trx.maybeOneFirst(psql`
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
                'id', ${contract.id}
                , 'name', ${contract.graphName}
                , 'type', 'contract'
              )
            , "contract_versions"."schema_version_id"
          FROM "contract_versions"
          WHERE "contract_versions"."contract_id" = ${contract.id}
          ORDER BY "contract_versions"."created_at" DESC, "contract_versions"."id" DESC
          LIMIT 1
          ON CONFLICT ("id") DO NOTHING
          RETURNING "id"
        `);

        if (!latestVersionId) {
          return;
        }

        await trx.query(psql`
          INSERT INTO "schema_version_changes" (
            "schema_version_id"
            , "change_type"
            , "severity_level"
            , "meta"
            , "is_safe_based_on_usage"
            )
          SELECT
            ${latestVersionId}
            , "contract_version_changes"."change_type"
            , "contract_version_changes"."severity_level"
            , "contract_version_changes"."meta"
            , "contract_version_changes"."is_safe_based_on_usage"
          FROM
            "contract_version_changes"
          WHERE
            "contract_version_changes"."contract_version_id" = ${latestVersionId}
        `);
      });

      await connection.transaction('latest valid version', async trx => {
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
              'id', ${contract.id}
              , 'name', ${contract.graphName}
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
          return;
        }

        await connection.query(psql`
          INSERT INTO "schema_version_changes" (
            "schema_version_id"
            , "change_type"
            , "severity_level"
            , "meta"
            , "is_safe_based_on_usage"
          )
          SELECT
            ${latestComposableVersionId}
            , "contract_version_changes"."change_type"
            , "contract_version_changes"."severity_level"
            , "contract_version_changes"."meta"
            , "contract_version_changes"."is_safe_based_on_usage"
          FROM
            "contract_version_changes"
          WHERE
            "contract_version_changes"."contract_version_id" = ${latestComposableVersionId}
        `);
      });
    }
  },
} satisfies MigrationExecutor;
