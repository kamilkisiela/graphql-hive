import { Inject, Injectable, Scope } from 'graphql-modules';
import {
  sql,
  UniqueIntegrityConstraintViolationError,
  type DatabasePool,
  type PrimitiveValueExpression,
} from 'slonik';
import { z } from 'zod';
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
      'Create contract (targetId=%s, userSpecifiedContractId=%s)',
      args.contract.targetId,
      args.contract.userSpecifiedContractId,
    );

    const validatedContract = CreateContractInputModel.safeParse(args.contract);
    if (!validatedContract.success) {
      this.logger.debug(
        'Create contract failed due to validation errors. (targetId=%s, userSpecifiedContractId=%s)',
        args.contract.targetId,
        args.contract.userSpecifiedContractId,
      );

      const allErrors = validatedContract.error.flatten().fieldErrors;
      return {
        type: 'error' as const,
        errors: {
          targetId: allErrors.targetId?.[0],
          userSpecifiedContractId: allErrors.userSpecifiedContractId?.[0],
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
          , "user_specified_contract_id"
          , "include_tags"
          , "exclude_tags"
          , "remove_unreachable_types_from_public_api_schema"
        ) VALUES (
          ${validatedContract.data.targetId}
          , ${validatedContract.data.userSpecifiedContractId}
          , ${toNullableTextArray(validatedContract.data.includeTags)}
          , ${toNullableTextArray(validatedContract.data.excludeTags)}
          , ${validatedContract.data.removeUnreachableTypesFromPublicApiSchema}
        )
        RETURNING ${contractFields}
    `);
    } catch (err: unknown) {
      if (
        err instanceof UniqueIntegrityConstraintViolationError &&
        err.constraint === 'contracts_target_id_user_specified_contract_id_key'
      ) {
        return {
          type: 'error' as const,
          errors: {
            userSpecifiedContractId: 'Must be unique across all target contracts.',
          },
        };
      }
      throw err;
    }

    const contract = ContractModel.parse(result);

    this.logger.debug(
      'Created contract successfully. (targetId=%s, contractId=%s, userSpecifiedContractId=%s)',
      args.contract.targetId,
      contract.id,
      contract.userSpecifiedContractId,
    );

    return {
      type: 'success' as const,
      contract: ContractModel.parse(result),
    };
  }

  async getContractsByTargetId(args: { targetId: string }): Promise<null | Array<Contract>> {
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
      '%n contract(s) found for target. (targetId=%s)',
      result.length,
      args.targetId,
    );
    return result.map(contract => ContractModel.parse(contract));
  }

  /**
   * Load all the latest valid contract versions for the list of contract ids.
   */
  async loadLatestValidContractVersionsByTargetId(args: {
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
        ${schemaVersionContractsFields}
      FROM
        "contract_versions"
      WHERE
        "target_id" = ${args.targetId}
        AND "contract_id" = ANY(${sql.array(args.contractIds, 'text')})
        AND "valid" = true
      ORDER BY
        "contract_id"
        , "created_at" DESC
    `);

    const records = new Map(
      result.map(raw => {
        const record = ValidSchemaVersionContractsModel.parse(raw);
        return [record.contractId, record];
      }),
    );

    this.logger.debug(
      '%n valid contract version(s) found for contracts. (targetId=%s, contractIds=%s)',
      records.size,
      args.targetId,
      args.contractIds.join(','),
    );

    return args.contractIds.map(contractId => records.get(contractId) ?? null);
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
  , "user_specified_contract_id" as "userSpecifiedContractId"
  , "include_tags" as "includeTags"
  , "exclude_tags" as "excludeTags"
  , "remove_unreachable_types_from_public_api_schema" as "removeUnreachableTypesFromPublicApiSchema"
  , to_json("created_at") as "createdAt"
`;

const ContractModel = z.object({
  id: z.string().uuid(),
  targetId: z.string().uuid(),
  userSpecifiedContractId: z.string(),
  includeTags: z.array(z.string()).nullable(),
  excludeTags: z.array(z.string()).nullable(),
  removeUnreachableTypesFromPublicApiSchema: z.boolean(),
  createdAt: z.string(),
});

export type Contract = z.TypeOf<typeof ContractModel>;

const CreateContractInputModel = z
  .object({
    targetId: z.string().uuid(),
    userSpecifiedContractId: z.string().max(64).min(2),
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
      message: 'Provide at least one value for each',
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

const schemaVersionContractsFields = sql`
  "id"
  , "schema_version_id" as "schemaVersionId"
  , "last_schema_version_contract_id" as "lastSchemaVersionContractId"
  , "contract_id" as "contractId"
  , "is_composable" as "isComposable"
  , "schema_composition_errors" as "schemaCompositionErrors"
  , "composite_schema_sdl" as "compositeSchemaSdl"
  , "supergraph_sdl" as "supergraphSdl"
  , to_json("created_at") as "createdAt"
`;

const ValidSchemaVersionContractsModel = z.object({
  id: z.string().uuid(),
  schemaVersionId: z.string().uuid(),
  lastSchemaVersionContractId: z.string().uuid().nullable(),
  contractId: z.string(),
  isComposable: z.literal(true),
  schemaCompositionErrors: z.null(),
  compositeSchemaSdl: z.string().nullable(),
  supergraphSdl: z.string(),
  createdAt: z.string(),
});
