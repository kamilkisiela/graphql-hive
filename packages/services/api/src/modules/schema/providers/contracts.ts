import { Inject, Injectable, Scope } from 'graphql-modules';
import {
  sql,
  UniqueIntegrityConstraintViolationError,
  type DatabasePool,
  type PrimitiveValueExpression,
} from 'slonik';
import { z } from 'zod';
import {
  decodeCreatedAtAndUUIDIdBasedCursor,
  encodeCreatedAtAndUUIDIdBasedCursor,
  HiveSchemaChangeModel,
  SchemaCompositionErrorModel,
} from '@hive/storage';
import { Logger } from '../../shared/providers/logger';
import { PG_POOL_CONFIG } from '../../shared/providers/pg-pool';

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class Contracts {
  private logger: Logger;
  constructor(
    logger: Logger,
    @Inject(PG_POOL_CONFIG) private pool: DatabasePool,
  ) {
    this.logger = logger.child({ source: 'Contracts' });
  }

  async createContract(args: { contract: CreateContractInput }) {
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
        errors: {
          targetId: allErrors.targetId?.[0],
          contractName: allErrors.contractName?.[0],
          includeTags: allErrors.includeTags?.[0],
          excludeTags: allErrors.excludeTags?.[0],
        },
      };
    }

    let result: unknown;
    try {
      result = await this.pool.maybeOne<unknown>(sql`
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
        RETURNING ${contractFields}
    `);
    } catch (err: unknown) {
      if (
        err instanceof UniqueIntegrityConstraintViolationError &&
        err.constraint === 'contracts_target_id_contract_name_key'
      ) {
        return {
          type: 'error' as const,
          errors: {
            contractName: 'Must be unique across all target contracts.',
          },
        };
      }
      throw err;
    }

    const contract = ContractModel.parse(result);

    this.logger.debug(
      'Created contract successfully. (targetId=%s, contractId=%s, contractName=%s)',
      args.contract.targetId,
      contract.id,
      contract.contractName,
    );

    return {
      type: 'success' as const,
      contract: ContractModel.parse(result),
    };
  }

  private async getContractsByTargetId(args: {
    targetId: string;
  }): Promise<null | Array<Contract>> {
    this.logger.debug('Load contracts for target. (targetId=%s)', args.targetId);
    const result = await this.pool.any<unknown>(sql`
      SELECT
        ${contractFields}
      FROM
        "contracts"
      WHERE
        "target_id" = ${args.targetId}
    `);

    if (result.length === 0) {
      this.logger.debug('No contracts found for target. (targetId=%s)', args.targetId);
      return null;
    }
    this.logger.debug(
      '%s contract(s) found for target. (targetId=%s)',
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

    const result = await this.pool.any<unknown>(sql`
      SELECT DISTINCT ON ("contract_id")
        ${contractVersionsFields}
      FROM
        "contract_versions"
      WHERE
        "contract_id" = ANY(${sql.array(args.contractIds, 'uuid')})
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

  public async loadContractsWithLatestValidContractVersionsByTargetId(args: { targetId: string }) {
    const contracts = await this.getContractsByTargetId(args);
    if (contracts === null) {
      return null;
    }
    const latestValidContractVersions = await this.loadLatestValidContractVersionsByTargetId({
      targetId: args.targetId,
      contractIds: contracts.map(c => c.id),
    });

    return contracts.map(contract => ({
      contract,
      latestValidVersion: latestValidContractVersions.get(contract.id) ?? null,
    }));
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

    const result = await this.pool.any<unknown>(sql`
      SELECT
        ${contractFields}
      FROM
        "contracts"
      WHERE
        "target_id" = ${args.targetId}
        ${
          cursor
            ? sql`
                AND (
                  (
                    c."created_at" = ${cursor.createdAt}
                    AND c."id" < ${cursor.id}
                  )
                  OR c."created_at" < ${cursor.createdAt}
                )
              `
            : sql``
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
  }): Promise<null | PaginatedContractCheckConnection> {
    this.logger.debug(
      'Load schema checks contracts for schema check. (schemaCheckId=%s)',
      args.schemaCheckId,
    );

    const result = await this.pool.any<unknown>(sql`
      SELECT
        "contract_checks"."id"
        , "contract_checks"."schema_check_id" as "schemaCheckId"
        , "contract_checks"."schema_check_id" as "schemaCheckId"
        , "contract_checks"."compared_contract_version_id" as "comparedContractVersionId"
        , "contract_checks"."is_success" as "isSuccess"
        , "contract_checks"."contract_name" as "contractName"
        , "contract_checks"."schema_composition_errors" as "schemaCompositionErrors"
        , "contract_checks"."breaking_schema_changes" as "breakingSchemaChanges"
        , "contract_checks"."safe_schema_changes" as "safeSchemaChanges"
        , "s_composite"."sdl" as "compositeSchemaSdl"
        , "s_supergraph"."sdl" as "supergraphSdl"
      FROM
        "contract_checks"
      LEFT JOIN
        "sdl_store" as "s_composite" ON "s_composite"."id" = "contract_checks"."composite_schema_sdl_store_id"
      LEFT JOIN
        "sdl_store" as "s_supergraph" ON "s_supergraph"."id" = "contract_checks"."supergraph_sdl_store_id"
      WHERE
        "schema_check_id" = ${args.schemaCheckId}
      ORDER BY
        "schema_check_id" ASC
       , "contract_name" ASC
    `);

    if (result.length === 0) {
      this.logger.debug(
        'No schema checks found for schema check. (schemaCheckId=%s)',
        args.schemaCheckId,
      );
      return null;
    }

    this.logger.debug(
      '%s schema checks found for schema check. (schemaCheckId=%s)',
      result.length,
      args.schemaCheckId,
    );

    const edges = result.map(row => {
      const node = ContractCheckModel.parse(row);
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

  public async getContractVersionById(args: { contractVersionId: string | null }) {
    if (args.contractVersionId === null) {
      return null;
    }

    this.logger.debug(
      'Load contract version by id. (contractVersionId=%s)',
      args.contractVersionId,
    );

    const result = await this.pool.maybeOne<unknown>(sql`
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
}

function toNullableTextArray<T extends PrimitiveValueExpression>(value: T[] | null) {
  if (value === null) {
    return null;
  }

  return sql.array(value, 'text');
}

const contractFields = sql`
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
    contractName: z.string().max(64).min(2),
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

const contractVersionsFields = sql`
  "id"
  , "schema_version_id" as "schemaVersionId"
  , "last_schema_version_contract_id" as "lastSchemaVersionContractId"
  , "contract_id" as "contractId"
  , "contract_name" as "contractName"
  , "schema_composition_errors" as "schemaCompositionErrors"
  , "composite_schema_sdl" as "compositeSchemaSdl"
  , "supergraph_sdl" as "supergraphSdl"
  , to_json("created_at") as "createdAt"
`;

const ValidContractVersionModel = z.object({
  id: z.string().uuid(),
  schemaVersionId: z.string().uuid(),
  lastSchemaVersionContractId: z.string().uuid().nullable(),
  contractId: z.string().nullable(),
  contractName: z.string(),
  schemaCompositionErrors: z.null(),
  compositeSchemaSdl: z.string().nullable(),
  supergraphSdl: z.string(),
  createdAt: z.string(),
});

const InvalidContractVersionModel = z.object({
  id: z.string().uuid(),
  schemaVersionId: z.string().uuid(),
  lastSchemaVersionContractId: z.string().uuid().nullable(),
  contractId: z.string().nullable(),
  contractName: z.string(),
  schemaCompositionErrors: z.array(SchemaCompositionErrorModel).nullable(),
  compositeSchemaSdl: z.string().nullable(),
  supergraphSdl: z.string().nullable(),
  createdAt: z.string(),
});

const ContractVersionModel = z.union([ValidContractVersionModel, InvalidContractVersionModel]);

export type ContractVersion = z.TypeOf<typeof ContractVersionModel>;

export type ValidSchemaVersionContract = z.TypeOf<typeof ValidContractVersionModel>;

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
  contractName: z.string(),

  schemaCompositionErrors: z.array(SchemaCompositionErrorModel).nullable(),
  compositeSchemaSdl: z.string().nullable(),
  supergraphSdl: z.string().nullable(),
  breakingSchemaChanges: z.array(HiveSchemaChangeModel).nullable(),
  safeSchemaChanges: z.array(HiveSchemaChangeModel).nullable(),
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
