import type { CheckPolicyResponse } from '@hive/policy';
import { CompositionFailureError } from '@hive/schema';
import type { SchemaChangeType, SchemaCompositionError } from '@hive/storage';
import type { Contract, ValidContractVersion } from '../contracts';
import type { SchemaCoordinatesDiffResult } from '../inspector';
import type {
  ContractCompositionResult,
  RegistryChecks,
  SchemaDiffResult,
} from '../registry-checks';
import type { CompositeSchemaInput, SingleSchemaInput } from '../schema-helper';

export const SchemaPublishConclusion = {
  /**
   * Schema hasn't been published to the registry, because it contains no changes
   */
  Ignore: 'IGNORE',
  /**
   * Schema has been published to the registry, either as composable (available on the CDN) or not composable (not available on the CDN)
   */
  Publish: 'PUBLISH',
  /**
   * Schema hasn't been published to the registry.
   * This is the case when
   * - the schema is not composable (legacy: except when --force flag is used)
   * - the schema contains breaking changes (legacy: except when --experimental_acceptBreakingChanges flag is used)
   * - the schema has no service name
   * - the schema has no service url
   */
  Reject: 'REJECT',
} as const;

export const SchemaCheckConclusion = {
  /**
   * Schema is composable and has no breaking changes
   */
  Success: 'SUCCESS',
  /**
   * Schema is either not composable or has breaking changes
   */
  Failure: 'FAILURE',
  /**
   * Skipped as the schemas have not changed from the latest schema version
   *
   * At this point, the schema is not checked for breaking changes or composition errors,
   * these are passed from the latest schema version (not necessarily the latest composable version).
   */
  Skip: 'SKIP',
} as const;

export const SchemaDeleteConclusion = {
  /**
   * Schema has been deleted. The new state is pushed to the CDN only if it's composable.
   */
  Accept: 'ACCEPT',
  /**
   * Schema hasn't been deleted.
   * This is the case when
   * - Build errors coming from GraphQL-JS
   * - Missing service name
   */
  Reject: 'REJECT',
} as const;

export type SchemaCheckConclusion =
  (typeof SchemaCheckConclusion)[keyof typeof SchemaCheckConclusion];
export type SchemaPublishConclusion =
  (typeof SchemaPublishConclusion)[keyof typeof SchemaPublishConclusion];
export type SchemaDeleteConclusion =
  (typeof SchemaDeleteConclusion)[keyof typeof SchemaDeleteConclusion];

export const CheckFailureReasonCode = {
  CompositionFailure: 'COMPOSITION_FAILURE',
  BreakingChanges: 'BREAKING_CHANGES',
  PolicyInfringement: 'POLICY_INFRINGEMENT',
} as const;

export type CheckFailureReasonCode =
  (typeof CheckFailureReasonCode)[keyof typeof CheckFailureReasonCode];

export type CheckPolicyResultRecord = CheckPolicyResponse[number] | { message: string };
export type SchemaCheckWarning = {
  message: string;
  source?: string;
  line?: number | null;
  column?: number | null;
  ruleId: string | null;
  endLine?: number | null;
  endColumn?: number | null;
};

type SuccessCompositionState = {
  type: 'success';
  errors: null;
  compositeSchemaSDL: string;
  supergraphSDL: null | string;
};

type FailureCompositionState = {
  type: 'failure';
  errors: Array<SchemaCompositionError>;
  compositeSchemaSDL: null | string;
  supergraphSDL: null;
};

export type CompositionState = SuccessCompositionState | FailureCompositionState;

type GroupedSchemaChanges = {
  breaking: Array<SchemaChangeType> | null;
  safe: Array<SchemaChangeType> | null;
  all: Array<SchemaChangeType> | null;
};

type ContractState = {
  contractId: string;
  contractName: string;
  /** the baseline schema used for comparison instead of the latest valid schema version */
  baselineComposition: null | CompositionState;
  schemaChanges: null | GroupedSchemaChanges;
  supergraphChanges: null | GroupedSchemaChanges;
};

export type ContractStateSuccess = ContractState & {
  isSuccessful: true;
  composition: SuccessCompositionState;
};

export type ContractStateFailure = ContractState & {
  isSuccessful: false;
  composition: CompositionState;
};

export type SchemaCheckSkip = {
  conclusion: typeof SchemaCheckConclusion.Skip;
  state?: never;
};

export type SchemaCheckSuccess = {
  conclusion: typeof SchemaCheckConclusion.Success;
  state: {
    /** the baseline schema used for comparison instead of the latest valid schema version */
    baselineComposition: null | CompositionState;
    /** the result of the main graph composition */
    composition: SuccessCompositionState;
    /** schema changes from the main graph to the latest valid schema version or baseline graph */
    schemaChanges: null | GroupedSchemaChanges;
    /** schema policy warnings of the main graph composition */
    schemaPolicy: null | {
      errors: null;
      warnings: SchemaCheckWarning[] | null;
    };
    /** the result of each contract graph composition alongside a diff to the previous graph version or baseline graph */
    contracts: null | Array<ContractStateSuccess>;
  };
};

export type SchemaCheckFailureReason = {
  /** the baseline schema used for comparison instead of the latest valid schema version */
  baselineComposition: null | CompositionState;
  /** the result of the main graph composition */
  composition: CompositionState;
  /** schema changes from the main graph to the latest valid schema version or baseline graph */
  schemaChanges: null | GroupedSchemaChanges;
  /** schema policy warnings of the main graph composition */
  schemaPolicy: null | {
    errors: SchemaCheckWarning[] | null;
    warnings: SchemaCheckWarning[] | null;
  };
  /** the result of each contract graph composition alongside a diff to the previous graph version or baseline graph */
  contracts: null | Array<ContractStateSuccess | ContractStateFailure>;
};

export type SchemaCheckFailure = {
  conclusion: typeof SchemaCheckConclusion.Failure;
  reason: SchemaCheckFailureReason;
};

export type SchemaCheckResult = SchemaCheckFailure | SchemaCheckSuccess | SchemaCheckSkip;

export const PublishIgnoreReasonCode = {
  NoChanges: 'NO_CHANGES',
} as const;

export const PublishFailureReasonCode = {
  MissingServiceUrl: 'MISSING_SERVICE_URL',
  CompositionFailure: 'COMPOSITION_FAILURE',
  BreakingChanges: 'BREAKING_CHANGES',
  MetadataParsingFailure: 'METADATA_PARSING_FAILURE',
} as const;

export type PublishIgnoreReasonCode =
  (typeof PublishIgnoreReasonCode)[keyof typeof PublishIgnoreReasonCode];
export type PublishFailureReasonCode =
  (typeof PublishFailureReasonCode)[keyof typeof PublishFailureReasonCode];

export type SchemaPublishFailureReason =
  | {
      code: (typeof PublishFailureReasonCode)['MissingServiceUrl'];
    }
  | {
      code: (typeof PublishFailureReasonCode)['MetadataParsingFailure'];
    }
  | {
      code: (typeof PublishFailureReasonCode)['CompositionFailure'];
      compositionErrors: Array<{
        message: string;
      }>;
    }
  | {
      code: (typeof PublishFailureReasonCode)['BreakingChanges'];
      breakingChanges: Array<SchemaChangeType>;
      changes: Array<SchemaChangeType>;
      coordinatesDiff: SchemaCoordinatesDiffResult;
    };

export type ContractResult = {
  contractId: string;
  contractName: string;
  compositionErrors: Array<SchemaCompositionError> | null;
  supergraph: string | null;
  fullSchemaSdl: string | null;
  changes: Array<SchemaChangeType> | null;
  supergraphChanges: Array<SchemaChangeType> | null;
};

type SchemaPublishSuccess = {
  conclusion: (typeof SchemaPublishConclusion)['Publish'];
  state: {
    composable: boolean;
    initial: boolean;
    coordinatesDiff: SchemaCoordinatesDiffResult | null;
    changes: Array<SchemaChangeType> | null;
    serviceChanges: Array<SchemaChangeType> | null;
    supergraphChanges: Array<SchemaChangeType> | null;
    messages: string[] | null;
    breakingChanges: Array<{
      message: string;
    }> | null;
    compositionErrors: Array<SchemaCompositionError> | null;
    schema: SingleSchemaInput | CompositeSchemaInput;
    schemas: [SingleSchemaInput] | CompositeSchemaInput[];
    previousSchemas: CompositeSchemaInput[] | null;
    supergraph: string | null;
    fullSchemaSdl: string | null;
    tags: null | Array<string>;
    schemaMetadata: null | Record<
      string,
      Array<{ name: string; content: string; source: string | null }>
    >;
    metadataAttributes: null | Record<string, string[]>;
    contracts: null | Array<ContractResult>;
  };
};

type SchemaPublishIgnored = {
  conclusion: (typeof SchemaPublishConclusion)['Ignore'];
  reason: (typeof PublishIgnoreReasonCode)['NoChanges'];
};

type SchemaPublishFailure = {
  conclusion: (typeof SchemaPublishConclusion)['Reject'];
  reasons: SchemaPublishFailureReason[];
};

export type SchemaPublishResult =
  | SchemaPublishSuccess
  | SchemaPublishFailure
  | SchemaPublishIgnored;

export const DeleteFailureReasonCode = {
  MissingServiceName: 'MISSING_SERVICE_NAME',
  CompositionFailure: 'COMPOSITION_FAILURE',
} as const;

export type DeleteFailureReasonCode =
  (typeof DeleteFailureReasonCode)[keyof typeof DeleteFailureReasonCode];

export type SchemaDeleteFailureReason =
  | {
      code: (typeof DeleteFailureReasonCode)['MissingServiceName'];
    }
  | {
      code: (typeof DeleteFailureReasonCode)['CompositionFailure'];
      compositionErrors: Array<SchemaCompositionError>;
    };

export type SchemaDeleteSuccess = {
  conclusion: (typeof SchemaDeleteConclusion)['Accept'];
  state: {
    changes: Array<SchemaChangeType> | null;
    schemas: CompositeSchemaInput[];
    breakingChanges: Array<SchemaChangeType> | null;
    compositionErrors: Array<SchemaCompositionError> | null;
    coordinatesDiff: SchemaCoordinatesDiffResult | null;
    supergraph: string | null;
    supergraphChanges: Array<SchemaChangeType> | null;
    tags: null | Array<string>;
    schemaMetadata: null | Record<
      string,
      Array<{ name: string; content: string; source: string | null }>
    >;
    metadataAttributes: null | Record<string, string[]>;
    contracts: null | Array<ContractResult>;
  } & (
    | {
        composable: true;
        fullSchemaSdl: string;
      }
    | { composable: false; fullSchemaSdl: null }
  );
};

export type SchemaDeleteFailure = {
  conclusion: (typeof SchemaDeleteConclusion)['Reject'];
  reasons: SchemaDeleteFailureReason[];
};

export type SchemaDeleteResult = SchemaDeleteFailure | SchemaDeleteSuccess;

type ReasonOf<T extends { code: string }[], R extends T[number]['code']> =
  T extends Array<infer U> ? (U extends { code: R } ? U : never) : never;

export function getReasonByCode<T extends { code: string }[], R extends T[number]['code']>(
  reasons: T,
  code: R,
): ReasonOf<T, R> | undefined {
  return reasons.find(r => r.code === code) as any;
}

export const temp = 'temp';

export function formatPolicyError(record: CheckPolicyResultRecord): { message: string } {
  if ('ruleId' in record) {
    return { message: `${record.message} (source: policy-${record.ruleId})` };
  }

  return { message: record.message };
}

export type ContractCheckInput = {
  contractId: string;
  contractName: string;
  compositionCheck: ContractCompositionResult;
  diffCheck: SchemaDiffResult;
  supergraphDiffCheck: SchemaDiffResult;
};

export function buildSchemaCheckFailureState(args: {
  compositionCheck: Awaited<ReturnType<RegistryChecks['composition']>>;
  diffCheck: Awaited<ReturnType<RegistryChecks['diff']>>;
  policyCheck: Awaited<ReturnType<RegistryChecks['policyCheck']>> | null;
  contractChecks: Array<ContractCheckInput> | null;
}): SchemaCheckFailure['reason'] {
  const compositionErrors: Array<CompositionFailureError> = [];

  if (args.compositionCheck.status === 'failed') {
    compositionErrors.push(...args.compositionCheck.reason.errors);
  }

  return {
    baselineComposition: null,
    composition:
      compositionErrors.length || args.compositionCheck.status === 'failed'
        ? {
            type: 'failure',
            errors: compositionErrors,
            compositeSchemaSDL: null,
            supergraphSDL: null,
          }
        : {
            type: 'success',
            errors: null,
            compositeSchemaSDL: args.compositionCheck.result.fullSchemaSdl,
            supergraphSDL: args.compositionCheck.result.supergraph ?? null,
          },
    schemaChanges: args.diffCheck.reason ?? args.diffCheck.result ?? null,
    schemaPolicy: args.policyCheck?.reason ?? args.policyCheck?.result ?? null,
    contracts:
      args.contractChecks?.map(contractCheck => {
        const state = {
          contractId: contractCheck.contractId,
          contractName: contractCheck.contractName,
          baselineComposition: null,
          schemaChanges: contractCheck.diffCheck.reason ?? contractCheck.diffCheck.result ?? null,
          supergraphChanges:
            contractCheck.supergraphDiffCheck.reason ??
            contractCheck.supergraphDiffCheck.result ??
            null,
        };

        if (
          contractCheck.compositionCheck.status === 'completed' &&
          contractCheck.diffCheck.status !== 'failed'
        ) {
          return {
            ...state,
            isSuccessful: true as const,
            composition: {
              type: 'success' as const,
              errors: null,
              compositeSchemaSDL: contractCheck.compositionCheck.result.fullSchemaSdl,
              supergraphSDL: contractCheck.compositionCheck.result.supergraph ?? null,
            },
          };
        }

        return {
          ...state,
          isSuccessful: false as const,
          composition:
            contractCheck.compositionCheck.status === 'failed'
              ? {
                  type: 'failure' as const,
                  errors: contractCheck.compositionCheck.reason.errors,
                  compositeSchemaSDL: null,
                  supergraphSDL: null,
                }
              : {
                  type: 'success' as const,
                  errors: null,
                  compositeSchemaSDL: contractCheck.compositionCheck.result.fullSchemaSdl,
                  supergraphSDL: contractCheck.compositionCheck.result.supergraph ?? null,
                },
        };
      }) ?? null,
  };
}

export type ContractInput = {
  contract: Contract;
  latestValidVersion: Pick<
    ValidContractVersion,
    'contractName' | 'compositeSchemaSdl' | 'supergraphSdl'
  > | null;
};
