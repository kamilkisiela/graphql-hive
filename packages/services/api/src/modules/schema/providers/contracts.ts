import { Injectable, Scope } from 'graphql-modules';
import { z } from 'zod';
import {
  PostgresDatabasePool,
  psql,
  UniqueIntegrityConstraintViolationError,
  type PrimitiveValueExpression,
} from '@hive/postgres';
import { fail, invariant } from '@hive/service-common';
import {
  decodeCreatedAtAndUUIDIdBasedCursor,
  encodeCreatedAtAndUUIDIdBasedCursor,
  HiveSchemaChangeModel,
  SchemaCompositionErrorModel,
  toSerializableSchemaChange,
  type SchemaChangeType,
  type SchemaCheckApprovalMetadata,
} from '@hive/storage';
import { isUUID } from '../../../shared/is-uuid';
import { GraphStore, type Graph } from '../../graph/providers/graph-store';
import { Logger } from '../../shared/providers/logger';
import { ArtifactStorageWriter } from './artifact-storage-writer';
import { SchemaVersion } from './schema-version-store';

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class Contracts {
  private logger: Logger;
  constructor(
    logger: Logger,
    private pool: PostgresDatabasePool,
    private artifactStorageWriter: ArtifactStorageWriter,
    private graphStore: GraphStore,
  ) {
    this.logger = logger.child({ source: 'Contracts' });
  }

  async createContract(args: {
    contract: CreateContractInput;
    organizationId: string;
    projectId: string;
    sourceGraphId: string;
  }) {
    this.logger.debug(
      'Create contract (targetId=%s, contractName=%s)',
      args.contract.targetId,
      args.contract.contractName,
    );

    const validatedContract = CreateContractInputModel.safeParse(args.contract);
    if (!validatedContract.success) {
      this.logger.debug(
        'Create contract failed due to validation errors. (targetId=%s, contractName=%s)',
        args.contract.targetId,
        args.contract.contractName,
      );

      const allErrors = validatedContract.error.flatten().fieldErrors;
      return {
        type: 'error' as const,
        message: 'Something went wrong.',
        errors: {
          targetId: allErrors.targetId?.[0],
          contractName: allErrors.contractName?.[0],
          includeTags: allErrors.includeTags?.[0],
          excludeTags: allErrors.excludeTags?.[0],
        },
      };
    }

    let contract: Contract;
    try {
      contract = await this.pool.transaction('create contract', async trx => {
        const contract = await trx
          .maybeOne(
            psql`
          INSERT INTO "contracts" (
            "target_id"
            , "contract_name"
            , "include_tags"
            , "exclude_tags"
            , "remove_unreachable_types_from_public_api_schema"
          ) VALUES (
            ${validatedContract.data.targetId}
            , ${validatedContract.data.contractName}
            , ${toNullableTextArray(validatedContract.data.includeTags)}
            , ${toNullableTextArray(validatedContract.data.excludeTags)}
            , ${validatedContract.data.removeUnreachableTypesFromPublicApiSchema}
          )
          RETURNING
            ${contractFields}
        `,
          )
          .then(ContractModel.parse);

        // Only create the graph record if the source graph id already exists
        if (args.sourceGraphId) {
          await this.graphStore.createGraph(
            {
              type: 'CONTRACT',
              id: contract.id,
              name: `default/${validatedContract.data.contractName}`,
              organizationId: args.organizationId,
              projectId: args.projectId,
              targetId: validatedContract.data.targetId,
              config: {
                includeTags: validatedContract.data.includeTags,
                excludeTags: validatedContract.data.excludeTags,
                removeUnreachableTypesFromPublicApiSchema:
                  validatedContract.data.removeUnreachableTypesFromPublicApiSchema,
              },
              sourceGraphId: args.sourceGraphId,
            },
            trx,
          );
        }
        return contract;
      });
    } catch (err: unknown) {
      if (
        err instanceof UniqueIntegrityConstraintViolationError &&
        err.constraint === 'contracts_target_id_contract_name_key'
      ) {
        return {
          type: 'error' as const,
          message: 'Something went wrong.',
          errors: {
            contractName: 'Must be unique across all target contracts.',
          },
        };
      }
      throw err;
    }

    this.logger.debug(
      'Created contract successfully. (targetId=%s, contractId=%s, contractName=%s)',
      args.contract.targetId,
      contract.id,
      contract.contractName,
    );

    return {
      type: 'success' as const,
      contract,
    };
  }

  async getContractById(args: { contractId: string }) {
    this.logger.debug('Load contract by id. (contractId=%s)', args.contractId);

    if (!isUUID(args.contractId)) {
      this.logger.debug('Invalid id provided, must be UUID. (contractId=%s)', args.contractId);
      return null;
    }

    const record = await this.pool.maybeOne(psql`
      SELECT
        ${contractFields}
      FROM
        "contracts"
      WHERE
        "id" = ${args.contractId}
    `);

    if (!record) {
      return null;
    }

    return ContractModel.parse(record);
  }

  async deleteContract(args: { contract: Contract }) {
    this.logger.debug('Delete contract (contractId=%s)', args.contract.id);

    const record = await this.pool.transaction('delete contract', async trx => {
      const record = await trx.maybeOne(psql`
        DELETE FROM
          "contracts"
        WHERE
          "id" = ${args.contract.id}
        RETURNING
          "id"
      `);

      await this.graphStore.deleteGraphByTargetIdAndName(
        args.contract.targetId,
        `default/${args.contract.contractName}`,
        trx,
      );

      return z.object({ id: z.string().uuid() }).nullable().parse(record);
    });

    if (!record) {
      return {
        type: 'error' as const,
        message: 'Contract not found.',
      };
    }

    this.logger.debug('Deleted contract. (contractId=%s)', args.contract.id);

    this.logger.debug(
      'Delete contract artifacts sdl and supergraph from CDN. (contractId=%s)',
      args.contract.id,
    );

    await Promise.all([
      this.artifactStorageWriter.deleteArtifact({
        targetId: args.contract.targetId,
        artifactType: 'sdl',
        contractName: args.contract.contractName,
      }),
      this.artifactStorageWriter.deleteArtifact({
        targetId: args.contract.targetId,
        artifactType: 'supergraph',
        contractName: args.contract.contractName,
      }),
    ]);

    return {
      type: 'success' as const,
      contractId: record.id,
    };
  }

  public async getActiveContractsByTargetId(args: {
    targetId: string;
  }): Promise<null | Array<Contract>> {
    this.logger.debug('Load active contracts for target. (targetId=%s)', args.targetId);
    const result = await this.pool.any(psql`
      SELECT
        ${contractFields}
      FROM
        "contracts"
      WHERE
        "target_id" = ${args.targetId}
        AND "is_disabled" = false
      ORDER BY
        "created_at" ASC
    `);

    if (result.length === 0) {
      this.logger.debug('No active contracts found for target. (targetId=%s)', args.targetId);
      return null;
    }
    this.logger.debug(
      '%s active contract(s) found for target. (targetId=%s)',
      result.length,
      args.targetId,
    );
    return result.map(contract => ContractModel.parse(contract));
  }

  /**
   * Load all the latest valid contract versions for the list of contract ids.
   */
  private async loadLatestValidContractVersionsByTargetId(args: {
    targetId: string;
    contractIds: Array<string>;
  }) {
    this.logger.debug(
      'Load latest valid contract versions for contracts. (targetId=%s, contractIds=%s)',
      args.targetId,
      args.contractIds.join(','),
    );

    const result = await this.pool.any(psql`
      SELECT DISTINCT ON ("contract_id")
        ${contractVersionsFields}
      FROM
        "contract_versions"
      WHERE
        "contract_id" = ANY(${psql.array(args.contractIds, 'uuid')})
        AND "schema_composition_errors" IS NULL
      ORDER BY
        "contract_id" ASC
        , "created_at" DESC
    `);

    const records = new Map(
      result.map(raw => {
        const record = ValidContractVersionModel.parse(raw);
        return [record.contractId, record];
      }),
    );

    this.logger.debug(
      '%n valid contract version(s) found for contracts. (targetId=%s, contractIds=%s)',
      records.size,
      args.targetId,
      args.contractIds.join(','),
    );

    return records;
  }

  public async loadActiveContractsWithLatestVersionsForGraphSchemaVersion(
    graph: Graph,
    schemaVersion: SchemaVersion | null,
  ): Promise<Map<string, ContractWithLatestVersions> | null> {
    const contracts = await this.getActiveContractsByTargetId({ targetId: graph.targetId });
    if (contracts === null) {
      return null;
    }

    const contractGraphs = await this.graphStore.findContractGraphsForGraph(graph);
    const map = new Map<string, ContractWithLatestVersions>();

    if (schemaVersion === null) {
      for (const contract of contracts) {
        map.set(contract.id, {
          contract,
          graph: contractGraphs.get(contract.id) ?? fail('Contract graph must exist.'),
          latestVersion: null,
          latestValidVersion: null,
        });
      }

      return map;
    }

    const contractIds = contracts.map(contract => contract.id);

    const latestContractVersionQueryResult = await this.pool.any(psql`
      SELECT DISTINCT ON ("contract_id")
        ${contractVersionsFields}
      FROM
        "contract_versions"
      WHERE
        "schema_version_id" = ${schemaVersion.id}
        AND "contract_id" = ANY(${psql.array(contractIds, 'uuid')})
      ORDER BY
        "contract_id" ASC
        , "created_at" DESC
    `);

    const contractIdsWhereWeNeedToGetTheLatestValidVersion: Array<ContractVersion> = [];

    const latestContractVersionsByContractId = new Map<string, ContractVersion>();
    const latestValidContractVersionByContractId = new Map<string, ValidContractVersion>();

    for (const raw of latestContractVersionQueryResult) {
      const record = ContractVersionModel.parse(raw);
      // If we looked of the version via the contract id it must be non-null :)
      invariant(record.contractId, 'Contract id must exist.');
      latestContractVersionsByContractId.set(record.contractId, record);
      if (record.isComposable === false) {
        contractIdsWhereWeNeedToGetTheLatestValidVersion.push(record);
      } else {
        latestValidContractVersionByContractId.set(record.contractId, record);
      }
    }

    if (contractIdsWhereWeNeedToGetTheLatestValidVersion.length) {
      const latestValidContractVersionQueryResult = await this.pool.any(psql`
        SELECT DISTINCT ON ("contract_id")
          ${contractVersionsFields}
        FROM
          "contract_versions"
        JOIN ${psql.unnest(
          contractIdsWhereWeNeedToGetTheLatestValidVersion.map(version => [
            version.contractId,
            version.createdAt,
          ]),
          ['uuid', 'timestamptz'],
        )} AS "filters" ("ccontract_id", "cutoff_date")
          ON "contract_versions"."contract_id" = "filters"."ccontract_id"
        WHERE
          "created_at" < filters."cutoff_date"
          AND "schema_composition_errors" IS NULL
        ORDER BY
          "contract_id" ASC
          , "created_at" DESC
      `);

      for (const raw of latestValidContractVersionQueryResult) {
        const record = ValidContractVersionModel.parse(raw);
        // If we looked of the version via the contract id it must be non-null :)
        invariant(record.contractId, 'Contract id must exist.');
        latestValidContractVersionByContractId.set(record.contractId, record);
      }
    }

    for (const contract of contracts) {
      map.set(contract.id, {
        contract,
        graph: contractGraphs.get(contract.id) ?? fail('Contract graph must exist.'),
        latestVersion: latestContractVersionsByContractId.get(contract.id) ?? null,
        latestValidVersion: latestValidContractVersionByContractId.get(contract.id) ?? null,
      } as ContractWithLatestVersions);
    }

    return map;
  }

  public async getPaginatedContractsByTargetId(args: {
    targetId: string;
    first: null | number;
    cursor: null | string;
  }): Promise<PaginatedContractConnection> {
    this.logger.debug('Load paginated contracts for target. (targetId=%s)', args.targetId);

    let cursor: null | {
      createdAt: string;
      id: string;
    } = null;

    const limit = args.first ? (args.first > 0 ? Math.min(args.first, 20) : 20) : 20;

    if (args.cursor) {
      cursor = decodeCreatedAtAndUUIDIdBasedCursor(args.cursor);
    }

    const result = await this.pool.any(psql` /* getPaginatedContractsByTargetId */
      SELECT
        ${contractFields}
      FROM
        "contracts"
      WHERE
        "target_id" = ${args.targetId}
        AND "is_disabled" = false
        ${
          cursor
            ? psql`
                AND (
                  (
                    c."created_at" = ${cursor.createdAt}
                    AND c."id" < ${cursor.id}
                  )
                  OR c."created_at" < ${cursor.createdAt}
                )
              `
            : psql``
        }
      ORDER BY
        "target_id" ASC,
        "created_at" DESC,
        "id" DESC
      LIMIT ${limit + 1}
    `);

    let edges = result.map(row => {
      const node = ContractModel.parse(row);

      return {
        node,
        get cursor() {
          return encodeCreatedAtAndUUIDIdBasedCursor(node);
        },
      };
    });

    const hasNextPage = edges.length > limit;

    edges = edges.slice(0, limit);

    return {
      edges,
      pageInfo: {
        hasNextPage,
        hasPreviousPage: cursor !== null,
        get endCursor() {
          return edges[edges.length - 1]?.cursor ?? '';
        },
        get startCursor() {
          return edges[0]?.cursor ?? '';
        },
      },
    };
  }

  public async getContractChecksBySchemaCheckId(args: {
    schemaCheckId: string;
    onlyFailedWithBreakingChanges: boolean;
  }) {
    this.logger.debug(
      'Load schema checks contracts for schema check. (schemaCheckId=%s)',
      args.schemaCheckId,
    );

    const result = await this.pool.any(psql`
      SELECT
        "contract_checks"."id"
        , "contract_checks"."schema_check_id" as "schemaCheckId"
        , "contract_checks"."compared_contract_version_id" as "comparedContractVersionId"
        , "contract_checks"."is_success" as "isSuccess"
        , "contract_checks"."contract_id" as "contractId"
        , "contracts"."contract_name" as "contractName"
        , "contract_checks"."schema_composition_errors" as "schemaCompositionErrors"
        , "contract_checks"."breaking_schema_changes" as "breakingSchemaChanges"
        , "contract_checks"."safe_schema_changes" as "safeSchemaChanges"
        , "s_composite"."sdl" as "compositeSchemaSdl"
        , "s_supergraph"."sdl" as "supergraphSdl"
        , "contract_checks"."baseline_schema_composition_errors" as "baselineSchemaCompositionErrors"
        , "s_baseline_composite"."sdl" as "baselineCompositeSchemaSdl"
        , "s_baseline_supergraph"."sdl" as "baselineSupergraphSdl"
      FROM
        "contract_checks"
      LEFT JOIN
        "contracts" ON "contracts"."id" = "contract_checks"."contract_id"
      LEFT JOIN
        "sdl_store" as "s_composite" ON "s_composite"."id" = "contract_checks"."composite_schema_sdl_store_id"
      LEFT JOIN
        "sdl_store" as "s_supergraph" ON "s_supergraph"."id" = "contract_checks"."supergraph_sdl_store_id"
      LEFT JOIN
        "sdl_store" as "s_baseline_composite" ON "s_baseline_composite"."id" = "contract_checks"."baseline_composite_schema_sdl_store_id"
      LEFT JOIN
        "sdl_store" as "s_baseline_supergraph" ON "s_baseline_supergraph"."id" = "contract_checks"."baseline_supergraph_sdl_store_id"
      WHERE
        "contract_checks"."schema_check_id" = ${args.schemaCheckId}
        ${
          args.onlyFailedWithBreakingChanges
            ? psql`
                AND (
                  "contract_checks"."is_success" = FALSE
                  AND "contract_checks"."schema_composition_errors" IS NULL
                  AND "contract_checks"."breaking_schema_changes" IS NOT NULL

              )`
            : psql``
        }
      ORDER BY
        "contract_checks"."schema_check_id" ASC
        , "contract_checks"."contract_id" ASC
    `);

    if (result.length === 0) {
      this.logger.debug(
        'No contract checks found for schema check. (schemaCheckId=%s)',
        args.schemaCheckId,
      );
      return null;
    }

    this.logger.debug(
      '%s schema checks found for schema check. (schemaCheckId=%s)',
      result.length,
      args.schemaCheckId,
    );

    return result.map(contractCheck => ContractCheckModel.parse(contractCheck));
  }

  /**
   * Returns true if any contracts were updated, returns false if no contracts were updated.
   */
  public async approveContractChecksForSchemaCheckId(args: {
    contextId: string | null;
    schemaCheckId: string;
    approvalMetadata: SchemaCheckApprovalMetadata;
  }) {
    this.logger.debug(
      'approve contract checks for schema check. (schemaCheckId=%s, contextId=%s)',
      args.schemaCheckId,
      args.contextId,
    );

    const contractChecks = await this.getContractChecksBySchemaCheckId({
      schemaCheckId: args.schemaCheckId,
      onlyFailedWithBreakingChanges: true,
    });

    if (!contractChecks) {
      this.logger.debug(
        'No contract checks found for schema check. (schemaCheckId=%s)',
        args.schemaCheckId,
      );
      return false;
    }

    const breakingChangeApprovalInserts: Array<
      [contractId: string, contextId: string, changeId: string, change: string]
    > = [];

    for (const contractCheck of contractChecks) {
      await this.pool.maybeOne(psql`
        UPDATE
          "contract_checks"
        SET
          "is_success" = true
          , "breaking_schema_changes" = (
            SELECT json_agg(
              CASE
                WHEN (COALESCE(jsonb_typeof("change"->'approvalMetadata'), 'null') = 'null' AND "change"->>'isSafeBasedOnUsage' = 'false')
                  THEN jsonb_set("change", '{approvalMetadata}', ${psql.jsonb(
                    args.approvalMetadata,
                  )})
                ELSE "change"
              END
            )
            FROM jsonb_array_elements("breaking_schema_changes") AS "change"
          )
        WHERE
          "id" = ${contractCheck.id}
          AND "is_success" = FALSE
          AND "schema_composition_errors" IS NULL
          AND "breaking_schema_changes" IS NOT NULL
        RETURNING
          "id"
      `);

      if (args.contextId !== null) {
        for (const change of contractCheck.breakingSchemaChanges ?? []) {
          if (change.isSafeBasedOnUsage) {
            continue;
          }

          breakingChangeApprovalInserts.push([
            contractCheck.contractId,
            args.contextId,
            change.id,
            JSON.stringify(
              toSerializableSchemaChange({
                ...change,
                approvalMetadata: args.approvalMetadata,
              }),
            ),
          ]);
        }
      }
    }

    if (breakingChangeApprovalInserts.length) {
      this.logger.debug(
        'insert breaking change approvals for contract checks. (schemaCheckId=%s, contextId=%s)',
        args.schemaCheckId,
        args.contextId,
      );
      // Try to approve and claim all the breaking schema changes for this context
      await this.pool.query(psql`
        INSERT INTO "contract_schema_change_approvals" (
          "contract_id"
          , "context_id"
          , "schema_change_id"
          , "schema_change"
        )
        SELECT * FROM ${psql.unnest(breakingChangeApprovalInserts, [
          'uuid',
          'text',
          'text',
          'jsonb',
        ])}
        ON CONFLICT ("contract_id", "context_id", "schema_change_id") DO NOTHING
      `);
    }

    return true;
  }

  public async getApprovedSchemaChangesForContracts(args: {
    contractIds: Array<string>;
    contextId: string;
  }) {
    const records = await this.pool.any(psql`
      SELECT
        "contract_id" as "contractId",
        "schema_change" as "schemaChange"
      FROM
        "contract_schema_change_approvals"
      WHERE
        "contract_id" = ANY(${psql.array(args.contractIds, 'uuid')})
        AND "context_id" = ${args.contextId}
    `);

    const schemaChangesByContractId = new Map<string, Map<string, SchemaChangeType>>();
    for (const record of records) {
      const { contractId, schemaChange } = SchemaChangeApprovalsForContractModel.parse(record);
      let schemaChangesForContract = schemaChangesByContractId.get(contractId);
      if (schemaChangesForContract === undefined) {
        schemaChangesForContract = new Map();
        schemaChangesByContractId.set(contractId, schemaChangesForContract);
      }
      schemaChangesForContract.set(schemaChange.id, schemaChange);
    }

    return schemaChangesByContractId;
  }

  public async getPaginatedContractChecksBySchemaCheckId(args: {
    schemaCheckId: string;
  }): Promise<null | PaginatedContractCheckConnection> {
    const contractChecks = await this.getContractChecksBySchemaCheckId({
      schemaCheckId: args.schemaCheckId,
      onlyFailedWithBreakingChanges: false,
    });

    if (!contractChecks) {
      return null;
    }

    const edges = contractChecks.map(node => {
      return {
        node,
        get cursor() {
          return node.id;
        },
      };
    });

    return {
      edges,
      pageInfo: {
        hasNextPage: false,
        hasPreviousPage: false,
        get endCursor() {
          return edges[edges.length - 1]?.cursor ?? '';
        },
        get startCursor() {
          return edges[0]?.cursor ?? '';
        },
      },
    };
  }

  public async getContractVersionById(args: { contractVersionId: string }) {
    if (args.contractVersionId === null) {
      return null;
    }

    this.logger.debug(
      'Load contract version by id. (contractVersionId=%s)',
      args.contractVersionId,
    );

    const result = await this.pool.maybeOne(psql`
      SELECT
        ${contractVersionsFields}
      FROM
        "contract_versions"
      WHERE
        "id" = ${args.contractVersionId}
    `);

    if (result === null) {
      this.logger.debug('No contract version found by id. (id=%s)', args.contractVersionId);
      return null;
    }

    this.logger.debug('Contract version found by id. (id=%s)', args.contractVersionId);

    return ContractVersionModel.parse(result);
  }

  public async getPreviousContractVersionForContractVersion(args: {
    contractVersion: ContractVersion;
  }) {
    const result = await this.pool.maybeOne(psql`
      SELECT
        ${contractVersionsFields}
      FROM
        "contract_versions"
      WHERE
        "contract_id" = ${args.contractVersion.contractId}
        AND (
          (
            "created_at" = ${args.contractVersion.createdAt}
            AND "id" < ${args.contractVersion.id}
          )
          OR "created_at" < ${args.contractVersion.createdAt}
        )
      ORDER BY
        "contract_id" ASC
        , "created_at" DESC
      LIMIT 1
    `);

    if (!result) {
      return null;
    }

    return ContractVersionModel.parse(result);
  }

  public async getDiffableContractVersionForContractVersion(args: {
    contractVersion: ContractVersion;
  }) {
    const result = await this.pool.maybeOne(psql`
      SELECT
        ${contractVersionsFields}
      FROM
        "contract_versions"
      WHERE
        "contract_id" = ${args.contractVersion.contractId}
        AND "schema_composition_errors" IS NULL
        AND (
          (
            "created_at" = ${args.contractVersion.createdAt}
            AND "id" < ${args.contractVersion.id}
          )
          OR "created_at" < ${args.contractVersion.createdAt}
        )
      ORDER BY
        "contract_id" ASC
        , "created_at" DESC
      LIMIT 1
    `);

    if (!result) {
      return null;
    }

    return ValidContractVersionModel.parse(result);
  }

  public async getContractVersionsForSchemaVersion(args: { schemaVersionId: string }) {
    this.logger.debug(
      'Load contract versions for schema version. (schemaVersionId=%s)',
      args.schemaVersionId,
    );

    const result = await this.pool.any(psql`
      SELECT
        ${contractVersionsFields}
      FROM
        "contract_versions"
      WHERE
        "schema_version_id" = ${args.schemaVersionId}
      ORDER BY
        "created_at" DESC
        , "contract_name" ASC
    `);

    if (result.length === 0) {
      this.logger.debug(
        'No contract versions found for schema version. (schemaVersionId=%s)',
        args.schemaVersionId,
      );

      return null;
    }

    this.logger.debug(
      'Found contract versions, returning connection. (schemaVersionId=%s)',
      args.schemaVersionId,
    );

    const edges = result.map(row => {
      const node = ContractVersionModel.parse(row);
      return {
        node,
        get cursor() {
          return node.id;
        },
      };
    });

    return {
      edges,
      pageInfo: {
        hasNextPage: false,
        hasPreviousPage: false,
        get endCursor() {
          return edges[edges.length - 1]?.cursor ?? '';
        },
        get startCursor() {
          return edges[0]?.cursor ?? '';
        },
      },
    };
  }

  public async getBreakingChangesForContractVersion(args: { contractVersionId: string }) {
    const changes = await this.pool.any(psql`
      SELECT
        "change_type" as "type",
        "meta",
        "is_safe_based_on_usage" as "isSafeBasedOnUsage"
      FROM
        "contract_version_changes"
      WHERE
        "contract_version_id" = ${args.contractVersionId}
        AND "severity_level" = 'BREAKING'
    `);

    if (changes.length === 0) {
      return null;
    }

    return changes.map(row => HiveSchemaChangeModel.parse(row));
  }

  public async getSafeChangesForContractVersion(args: { contractVersionId: string }) {
    const changes = await this.pool.any(psql`
      SELECT
        "change_type" as "type",
        "meta",
        "is_safe_based_on_usage" as "isSafeBasedOnUsage"
      FROM
        "contract_version_changes"
      WHERE
        "contract_version_id" = ${args.contractVersionId}
        AND "severity_level" <> 'BREAKING'
    `);

    if (changes.length === 0) {
      return null;
    }

    return changes.map(row => HiveSchemaChangeModel.parse(row));
  }

  public async getAllChangesForContractVersion(args: { contractVersionId: string }) {
    const changes = await this.pool.any(psql`
      SELECT
        "change_type" as "type",
        "meta",
        "is_safe_based_on_usage" as "isSafeBasedOnUsage"
      FROM
        "contract_version_changes"
      WHERE
        "contract_version_id" = ${args.contractVersionId}
    `);

    if (changes.length === 0) {
      return null;
    }

    return changes.map(row => HiveSchemaChangeModel.parse(row));
  }
}

function toNullableTextArray<T extends PrimitiveValueExpression>(value: T[] | null) {
  if (value === null) {
    return null;
  }

  return psql.array(value, 'text');
}

const contractFields = psql`
  "id"
  , "target_id" as "targetId"
  , "contract_name" as "contractName"
  , "include_tags" as "includeTags"
  , "exclude_tags" as "excludeTags"
  , "remove_unreachable_types_from_public_api_schema" as "removeUnreachableTypesFromPublicApiSchema"
  , to_json("created_at") as "createdAt"
`;

const ContractModel = z.object({
  id: z.string().uuid(),
  targetId: z.string().uuid(),
  contractName: z.string(),
  includeTags: z
    .array(z.string())
    .nullable()
    .transform(tags => (tags?.length === 0 ? null : tags)),
  excludeTags: z
    .array(z.string())
    .nullable()
    .transform(tags => (tags?.length === 0 ? null : tags)),
  removeUnreachableTypesFromPublicApiSchema: z.boolean(),
  createdAt: z.string(),
});

export type Contract = z.TypeOf<typeof ContractModel>;

const CreateContractInputModel = z
  .object({
    targetId: z.string().uuid(),
    contractName: z
      .string()
      .max(64)
      .min(2)
      .toLowerCase()
      .regex(/^[a-zA-Z0-9_-]+$/, "Can only contain letters, numbers, '_', and '-'"),
    includeTags: z.array(z.string()).nullable(),
    excludeTags: z.array(z.string()).nullable(),
    removeUnreachableTypesFromPublicApiSchema: z.boolean(),
  })
  .refine(
    args => {
      const hasIncludeTags = !!args.includeTags?.length;
      const hasExcludeTags = !!args.excludeTags?.length;
      if (!hasIncludeTags && !hasExcludeTags) {
        return false;
      }
      return true;
    },
    {
      message: 'Provide at least one value for either included tags or excluded tags',
      path: ['includeTags', 'excludeTags'],
    },
  )
  .refine(args => hasIntersection(new Set(args.includeTags), new Set(args.excludeTags)) === false, {
    message: 'Included and exclude tags must not intersect',
    path: ['includeTags', 'excludeTags'],
  });

export type CreateContractInput = z.infer<typeof CreateContractInputModel>;

/** check whether two sets have an intersection with each other. */
function hasIntersection<T>(a: Set<T>, b: Set<T>): boolean {
  if (a.size === 0 || b.size === 0) {
    return false;
  }
  for (const item of a) {
    if (b.has(item)) {
      return true;
    }
  }
  return false;
}

const contractVersionsFields = psql`
  "id"
  , "schema_version_id" as "schemaVersionId"
  , "contract_id" as "contractId"
  , "contract_name" as "contractName"
  , "schema_composition_errors" as "schemaCompositionErrors"
  , "composite_schema_sdl" as "compositeSchemaSdl"
  , "supergraph_sdl" as "supergraphSdl"
  , to_json("created_at") as "createdAt"
`;

const ValidContractVersionModel = z
  .object({
    id: z.string().uuid(),
    schemaVersionId: z.string().uuid(),
    contractId: z.string().nullable(),
    contractName: z.string(),
    schemaCompositionErrors: z.null(),
    compositeSchemaSdl: z.string().nullable(),
    supergraphSdl: z.string(),
    createdAt: z.string(),
  })
  .transform(record => ({
    ...record,
    isComposable: true as const,
  }));

const InvalidContractVersionModel = z
  .object({
    id: z.string().uuid(),
    schemaVersionId: z.string().uuid(),
    contractId: z.string().nullable(),
    contractName: z.string(),
    schemaCompositionErrors: z.array(SchemaCompositionErrorModel).nullable(),
    compositeSchemaSdl: z.string().nullable(),
    supergraphSdl: z.string().nullable(),
    createdAt: z.string(),
  })
  .transform(record => ({
    ...record,
    isComposable: false as const,
  }));

const ContractVersionModel = z.union([ValidContractVersionModel, InvalidContractVersionModel]);

export type ContractVersion = z.TypeOf<typeof ContractVersionModel>;

export type ValidContractVersion = z.TypeOf<typeof ValidContractVersionModel>;

export type PaginatedContractConnection = Readonly<{
  edges: ReadonlyArray<{
    node: Contract;
    cursor: string;
  }>;
  pageInfo: Readonly<{
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor: string;
    endCursor: string;
  }>;
}>;

export type GetPaginatedContractsByTargetId = {
  targetId: string;
  first: null | number;
  cursor: null | string;
};

const ContractCheckModel = z.object({
  id: z.string().uuid(),
  schemaCheckId: z.string().uuid(),
  /** The contract version against this check was performed */
  comparedContractVersionId: z.string().uuid().nullable(),

  isSuccess: z.boolean(),
  contractId: z.string().uuid(),
  contractName: z.string(),

  schemaCompositionErrors: z.array(SchemaCompositionErrorModel).nullable(),
  compositeSchemaSdl: z.string().nullable(),
  supergraphSdl: z.string().nullable(),
  breakingSchemaChanges: z.array(HiveSchemaChangeModel).nullable(),
  safeSchemaChanges: z.array(HiveSchemaChangeModel).nullable(),

  baselineSchemaCompositionErrors: z.array(SchemaCompositionErrorModel).nullable(),
  baselineCompositeSchemaSdl: z.string().nullable(),
  baselineSupergraphSdl: z.string().nullable(),
});

const SchemaChangeApprovalsForContractModel = z.object({
  contractId: z.string().uuid(),
  schemaChange: HiveSchemaChangeModel,
});

export type ContractCheck = z.TypeOf<typeof ContractCheckModel>;

export type PaginatedContractCheckConnection = Readonly<{
  edges: ReadonlyArray<{
    node: z.infer<typeof ContractCheckModel>;
    cursor: string;
  }>;
  pageInfo: Readonly<{
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor: string;
    endCursor: string;
  }>;
}>;

export type ContractWithLatestVersions = {
  contract: Contract;
  graph: Graph;
  latestVersion: ContractVersion | null;
  latestValidVersion: ValidContractVersion | null;
};

export type ContractWithLatestValidVersion = {
  contract: Contract;
  latestValidVersion: ValidContractVersion | null;
};
