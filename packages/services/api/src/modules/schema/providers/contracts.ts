import { Injectable, Scope } from 'graphql-modules';
import { z } from 'zod';
import {
  PostgresDatabasePool,
  psql,
  UniqueIntegrityConstraintViolationError,
} from '@hive/postgres';
import { invariant } from '@hive/service-common';
import {
  HiveSchemaChangeModel,
  SchemaCompositionErrorModel,
  toSerializableSchemaChange,
  type SchemaChangeType,
  type SchemaCheckApprovalMetadata,
} from '@hive/storage';
import { GraphStore, type ContractGraph, type Graph } from '../../graph/providers/graph-store';
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

    let graph: ContractGraph;
    try {
      graph = await this.pool.transaction('create contract', async trx => {
        const graph = await this.graphStore.createGraph(
          {
            type: 'CONTRACT',
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

        invariant(graph.type === 'CONTRACT', 'Created graph must be a contract graph.');

        return graph;
      });
    } catch (err: unknown) {
      if (
        err instanceof UniqueIntegrityConstraintViolationError &&
        err.constraint === 'graphs_target_id_name_key'
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
      graph.id,
      graph.name,
    );

    return {
      type: 'success' as const,
      graph,
    };
  }

  async deleteContractGraph(graph: ContractGraph) {
    this.logger.debug('Delete contract (graphId=%s)', graph.id);

    await this.graphStore.deleteGraph(graph);

    this.logger.debug('Deleted contract graph. (graphId=%s)', graph.id);

    this.logger.debug(
      'Delete contract graph artifacts sdl and supergraph from CDN. (graphId=%s)',
      graph.id,
    );

    await Promise.all([
      this.artifactStorageWriter.deleteArtifact({
        targetId: graph.targetId,
        artifactType: 'sdl',
        contractName: graph.name,
      }),
      this.artifactStorageWriter.deleteArtifact({
        targetId: graph.targetId,
        artifactType: 'supergraph',
        contractName: graph.name,
      }),
    ]);

    return {
      type: 'success' as const,
      contractId: graph.id,
    };
  }

  public async loadContractGraphsWithLatestVersionsForGraphSchemaVersion(
    graph: Graph,
    schemaVersion: SchemaVersion | null,
  ): Promise<Map<string, ContractWithLatestVersions> | null> {
    const contractGraphs = await this.graphStore.findContractGraphsForGraph(graph);
    if (contractGraphs.size === 0) {
      return null;
    }

    const map = new Map<string, ContractWithLatestVersions>();

    if (schemaVersion === null) {
      for (const graph of contractGraphs.values()) {
        map.set(graph.id, {
          graph,
          latestVersion: null,
          latestValidVersion: null,
        });
      }

      return map;
    }

    const graphIds = contractGraphs
      .values()
      .map(graph => graph.id)
      .toArray();

    const contractSchemaVersions = await this.pool
      .any(
        psql`
        SELECT
          ${primaryContractVersionFields}
        FROM
          "schema_versions"
        WHERE
          "graph_id" = ANY(${psql.array(graphIds, 'uuid')})
          AND "source_schema_version_id" = ${schemaVersion.id}
          AND "graph_metadata"->>'type' = 'contract'
      `,
      )
      .then(z.array(PrimaryContractVersionModel).parse);

    const contractIdsWhereWeNeedToGetTheLatestValidVersion: Array<ContractVersion> = [];

    const latestContractVersionsByContractId = new Map<string, ContractVersion>();
    const latestValidContractVersionByContractId = new Map<string, ValidContractVersion>();

    for (const record of contractSchemaVersions) {
      invariant(record.contractId, 'Contract id must exist.');
      latestContractVersionsByContractId.set(record.contractId, record);
      if (record.isComposable === false) {
        contractIdsWhereWeNeedToGetTheLatestValidVersion.push(record);
      } else {
        latestValidContractVersionByContractId.set(record.contractId, record);
      }
    }

    for (const version of contractIdsWhereWeNeedToGetTheLatestValidVersion) {
      invariant(version.contractId, 'Contract id must exist.');
      const pointerVersion = version.diffSchemaVersionId
        ? await this.getContractVersionById({ contractVersionId: version.diffSchemaVersionId })
        : null;
      if (pointerVersion?.isComposable) {
        latestValidContractVersionByContractId.set(version.contractId, pointerVersion);
        continue;
      }
    }

    for (const graph of contractGraphs.values()) {
      map.set(graph.id, {
        graph,
        latestVersion: latestContractVersionsByContractId.get(graph.id) ?? null,
        latestValidVersion: latestValidContractVersionByContractId.get(graph.id) ?? null,
      } as ContractWithLatestVersions);
    }

    return map;
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
        , COALESCE("graphs"."name", "contract_checks"."contract_name") as "contractName"
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
        "graphs"
          ON "graphs"."id" = "contract_checks"."contract_id"
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
        ${
          psql``
          // Contract checks can outlive their graph after a historical cascade-delete bug.
          // Keep only rows whose contract name is still available, either from the current
          // graph or from the name stored on the check (which we introduced to mitigate the cascade-delete bug)
          // so every returned record is valid and can be displayed.
          // Any record that cannot be displayed is treated as non-existing...
        }
        AND (
          "contract_checks"."contract_name" IS NOT NULL
          OR "graphs"."name" IS NOT NULL
        )
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

    const primaryResult = await this.pool.maybeOne(psql`
      SELECT
        ${primaryContractVersionFields}
      FROM
        "schema_versions"
      WHERE
        "id" = ${args.contractVersionId}
        AND "source_schema_version_id" IS NOT NULL
        AND "graph_metadata"->>'type' = 'contract'
    `);

    if (primaryResult) {
      return PrimaryContractVersionModel.parse(primaryResult);
    }

    const legacyResult = await this.pool.maybeOne(psql`
      SELECT
        ${legacyContractVersionFields}
      FROM
        "contract_versions"
      WHERE
        "id" = ${args.contractVersionId}
    `);

    if (legacyResult === null) {
      this.logger.debug('No contract version found by id. (id=%s)', args.contractVersionId);
      return null;
    }

    this.logger.debug('Contract version found by id. (id=%s)', args.contractVersionId);

    return LegacyContractVersionModel.parse(legacyResult);
  }

  public async getPreviousContractVersionForContractVersion(args: {
    contractVersion: ContractVersion;
  }) {
    if (args.contractVersion.source === 'schema_versions') {
      if (args.contractVersion.previousSchemaVersionId) {
        const pointerVersion = await this.getContractVersionById({
          contractVersionId: args.contractVersion.previousSchemaVersionId,
        });
        if (pointerVersion) {
          return pointerVersion;
        }
      }

      const primaryVersion = await this.getPrimaryContractVersionBefore(
        args.contractVersion,
        false,
      );
      if (primaryVersion) {
        return primaryVersion;
      }
    }

    return await this.getLegacyContractVersionBefore(args.contractVersion, false);
  }

  public async getDiffableContractVersionForContractVersion(args: {
    contractVersion: ContractVersion;
  }): Promise<ValidContractVersion | null> {
    if (args.contractVersion.source === 'schema_versions') {
      if (args.contractVersion.diffSchemaVersionId) {
        const version = await this.getContractVersionById({
          contractVersionId: args.contractVersion.diffSchemaVersionId,
        });
        if (version?.isComposable) {
          return version;
        }
      }

      const primaryVersion = await this.getPrimaryContractVersionBefore(args.contractVersion, true);
      if (primaryVersion?.isComposable) {
        return primaryVersion;
      }
    }

    const legacyVersion = await this.getLegacyContractVersionBefore(args.contractVersion, true);
    return legacyVersion?.isComposable ? legacyVersion : null;
  }

  private async getPrimaryContractVersionBefore(
    contractVersion: ContractVersion,
    onlyComposable: boolean,
  ) {
    const result = await this.pool.maybeOne(psql`
      SELECT
        ${primaryContractVersionFields}
      FROM
        "schema_versions"
      WHERE
        COALESCE("graph_id"::text, "graph_metadata"->>'id') = ${contractVersion.contractId}
        AND "source_schema_version_id" IS NOT NULL
        AND "graph_metadata"->>'type' = 'contract'
        ${onlyComposable ? psql`AND "is_composable" = true` : psql``}
        AND ("created_at", "id") < (${contractVersion.createdAt}, ${contractVersion.id})
      ORDER BY
        "created_at" DESC,
        "id" DESC
      LIMIT 1
    `);

    return result ? PrimaryContractVersionModel.parse(result) : null;
  }

  private async getLegacyContractVersionBefore(
    contractVersion: ContractVersion,
    onlyComposable: boolean,
  ) {
    const result = await this.pool.maybeOne(psql`
      SELECT
        ${legacyContractVersionFields}
      FROM
        "contract_versions"
      WHERE
        "contract_id" = ${contractVersion.contractId}
        ${onlyComposable ? psql`AND "schema_composition_errors" IS NULL` : psql``}
        AND ("created_at", "id") < (${contractVersion.createdAt}, ${contractVersion.id})
      ORDER BY
        "created_at" DESC,
        "id" DESC
      LIMIT 1
    `);

    return result ? LegacyContractVersionModel.parse(result) : null;
  }

  public async getContractVersionsForSchemaVersion(args: { schemaVersionId: string }) {
    this.logger.debug(
      'Load contract versions for schema version. (schemaVersionId=%s)',
      args.schemaVersionId,
    );

    const [primaryVersions, legacyVersions] = await Promise.all([
      this.pool
        .any(
          psql`
          SELECT
            ${primaryContractVersionFields}
          FROM
            "schema_versions"
          WHERE
            "source_schema_version_id" = ${args.schemaVersionId}
            AND "graph_metadata"->>'type' = 'contract'
        `,
        )
        .then(z.array(PrimaryContractVersionModel).parse),
      this.pool
        .any(
          psql`
          SELECT
            ${legacyContractVersionFields}
          FROM
            "contract_versions"
          WHERE
            "schema_version_id" = ${args.schemaVersionId}
        `,
        )
        .then(z.array(LegacyContractVersionModel).parse),
    ]);

    const primaryIds = new Set(primaryVersions.map(version => version.id));
    const result = [
      ...primaryVersions,
      ...legacyVersions.filter(row => !primaryIds.has(row.id)),
    ].sort(
      (left, right) =>
        right.createdAt.localeCompare(left.createdAt) ||
        left.contractName.localeCompare(right.contractName) ||
        right.id.localeCompare(left.id),
    );

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
      const node = row;
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

  public async getAllChangesForContractVersion(args: { contractVersion: ContractVersion }) {
    const isPrimary = args.contractVersion.source === 'schema_versions';
    const changes = await this.pool.any(psql`
      SELECT
        "change_type" as "type",
        "meta",
        "is_safe_based_on_usage" as "isSafeBasedOnUsage"
      FROM
        ${isPrimary ? psql`"schema_version_changes"` : psql`"contract_version_changes"`}
      WHERE
        ${
          isPrimary
            ? psql`"schema_version_id" = ${args.contractVersion.id}`
            : psql`"contract_version_id" = ${args.contractVersion.id}`
        }
    `);

    if (changes.length === 0) {
      return null;
    }

    return changes.map(row => HiveSchemaChangeModel.parse(row));
  }
}

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

const legacyContractVersionFields = psql`
  "id"
  , "schema_version_id" as "schemaVersionId"
  , "contract_id" as "contractId"
  , 'default/'||"contract_name"  as "contractName"
  , "schema_composition_errors" as "schemaCompositionErrors"
  , "composite_schema_sdl" as "compositeSchemaSdl"
  , "supergraph_sdl" as "supergraphSdl"
  , to_json("created_at") as "createdAt"
  , NULL::uuid as "previousSchemaVersionId"
  , NULL::uuid as "diffSchemaVersionId"
`;

const ContractVersionBaseModel = z.object({
  id: z.string().uuid(),
  schemaVersionId: z.string().uuid(),
  contractId: z.string().uuid().nullable(),
  contractName: z.string(),
  compositeSchemaSdl: z.string().nullable(),
  createdAt: z.string(),
  previousSchemaVersionId: z.string().uuid().nullable(),
  diffSchemaVersionId: z.string().uuid().nullable(),
});

const ValidContractVersionFieldsModel = ContractVersionBaseModel.extend({
  schemaCompositionErrors: z.null(),
  supergraphSdl: z.string(),
  isComposable: z.literal(true),
});

const InvalidContractVersionFieldsModel = ContractVersionBaseModel.extend({
  schemaCompositionErrors: z.array(SchemaCompositionErrorModel).nullable(),
  supergraphSdl: z.string().nullable(),
  isComposable: z.literal(false),
});

const ContractVersionFieldsModel = z.discriminatedUnion('isComposable', [
  ValidContractVersionFieldsModel,
  InvalidContractVersionFieldsModel,
]);

const LegacyContractVersionRawModel = z
  .object({
    id: z.string().uuid(),
    schemaVersionId: z.string().uuid(),
    contractId: z.string().uuid().nullable(),
    contractName: z.string(),
    schemaCompositionErrors: z.array(SchemaCompositionErrorModel).nullable(),
    compositeSchemaSdl: z.string().nullable(),
    supergraphSdl: z.string().nullable(),
    createdAt: z.string(),
    previousSchemaVersionId: z.null(),
    diffSchemaVersionId: z.null(),
  })
  .transform(record => ({
    ...record,
    source: 'contract_versions' as const,
    isComposable: record.schemaCompositionErrors === null && record.supergraphSdl !== null,
  }));

const LegacyContractVersionModel = LegacyContractVersionRawModel.pipe(
  ContractVersionFieldsModel.and(z.object({ source: z.literal('contract_versions') })),
);

const primaryContractVersionFields = psql`
  "id"
  , "source_schema_version_id" as "schemaVersionId"
  , COALESCE("graph_id"::text, "graph_metadata"->>'id') as "contractId"
  , "graph_metadata"->>'name' as "contractName"
  , "schema_composition_errors" as "schemaCompositionErrors"
  , "composite_schema_sdl" as "compositeSchemaSdl"
  , "supergraph_sdl" as "supergraphSdl"
  , to_json("created_at") as "createdAt"
  , "previous_schema_version_id" as "previousSchemaVersionId"
  , "diff_schema_version_id" as "diffSchemaVersionId"
  , "is_composable" as "isComposable"
`;

const PrimaryContractVersionModel = z
  .object({
    id: z.string().uuid(),
    schemaVersionId: z.string().uuid(),
    contractId: z.string().uuid(),
    contractName: z.string(),
    schemaCompositionErrors: z.array(SchemaCompositionErrorModel).nullable(),
    compositeSchemaSdl: z.string().nullable(),
    supergraphSdl: z.string().nullable(),
    createdAt: z.string(),
    previousSchemaVersionId: z.string().uuid().nullable(),
    diffSchemaVersionId: z.string().uuid().nullable(),
    isComposable: z.boolean(),
  })
  .transform(record => ({
    ...record,
    source: 'schema_versions' as const,
  }))
  .pipe(ContractVersionFieldsModel.and(z.object({ source: z.literal('schema_versions') })));

const ContractVersionModel = z.union([PrimaryContractVersionModel, LegacyContractVersionModel]);

export type ContractVersion = z.TypeOf<typeof ContractVersionModel>;
export type ContractVersionSource = ContractVersion['source'];
export type ValidContractVersion = ContractVersion & {
  isComposable: true;
  schemaCompositionErrors: null;
  supergraphSdl: string;
};

export type PaginatedContractConnection = Readonly<{
  edges: ReadonlyArray<{
    node: ContractGraph;
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
  graph: ContractGraph;
  latestVersion: ContractVersion | null;
  latestValidVersion: ValidContractVersion | null;
};

export type ContractWithLatestValidVersion = {
  graph: ContractGraph;
  latestValidVersion: ValidContractVersion | null;
};
