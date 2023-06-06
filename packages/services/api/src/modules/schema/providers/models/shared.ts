import {
  PushedCompositeSchema,
  SchemaCompositionError,
  SingleSchema,
} from 'packages/services/api/src/shared/entities';
import { Change } from '@graphql-inspector/core';
import type { CheckPolicyResponse } from '@hive/policy';
import { type RegistryChecks } from '../registry-checks';

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
  source?: string | undefined | null;

  line?: number;
  column?: number;
};

export type SchemaCheckSuccess = {
  conclusion: (typeof SchemaCheckConclusion)['Success'];
  state: {
    schemaChanges: Array<Change> | null;
    schemaPolicyWarnings: SchemaCheckWarning[] | null;
  };
};

export type SchemaCheckFailure = {
  conclusion: (typeof SchemaCheckConclusion)['Failure'];
  state: {
    // TODO: in theory if composition errors are present schema policy and schema changes would always be null
    // we could express this with the type-system in a stricter way.
    compositionErrors: Array<{ message: string }> | null;
    /** Absence means schema changes were skipped. */
    schemaChanges: null | {
      breaking: Array<Change>;
      safe: Array<Change>;
    };
    /** Absence means the schema policy is disabled or wasn't done because composition failed. */
    schemaPolicy: null | {
      errors: SchemaCheckWarning[] | null;
      warnings: SchemaCheckWarning[] | null;
    };
  };
};

export type SchemaCheckResult = SchemaCheckFailure | SchemaCheckSuccess;

export const PublishIgnoreReasonCode = {
  NoChanges: 'NO_CHANGES',
} as const;

export const PublishFailureReasonCode = {
  MissingServiceUrl: 'MISSING_SERVICE_URL',
  MissingServiceName: 'MISSING_SERVICE_NAME',
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
      code: (typeof PublishFailureReasonCode)['MissingServiceName'];
    }
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
      breakingChanges: Array<Change>;
      changes: Array<Change>;
    };

type SchemaPublishSuccess = {
  conclusion: (typeof SchemaPublishConclusion)['Publish'];
  state: {
    composable: boolean;
    initial: boolean;
    changes: Array<Change> | null;
    messages: string[] | null;
    breakingChanges: Array<{
      message: string;
    }> | null;
    compositionErrors: Array<SchemaCompositionError> | null;
    schema: SingleSchema | PushedCompositeSchema;
    schemas: [SingleSchema] | PushedCompositeSchema[];
    supergraph: string | null;
    fullSchemaSdl: string | null;
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
    changes: Array<Change> | null;
    breakingChanges: Array<Change> | null;
    compositionErrors: Array<SchemaCompositionError> | null;
    supergraph: string | null;
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

type ReasonOf<T extends { code: string }[], R extends T[number]['code']> = T extends Array<infer U>
  ? U extends { code: R }
    ? U
    : never
  : never;

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

export function buildSchemaCheckFailureState(args: {
  compositionCheck: Awaited<ReturnType<RegistryChecks['composition']>>;
  diffCheck: Awaited<ReturnType<RegistryChecks['diff']>>;
  policyCheck: Awaited<ReturnType<RegistryChecks['policyCheck']>> | null;
}): SchemaCheckFailure['state'] {
  const compositionErrors: Array<{ message: string }> = [];
  let schemaChanges: null | {
    breaking: Array<Change>;
    safe: Array<Change>;
  } = null;
  let schemaPolicy: null | {
    errors: SchemaCheckWarning[] | null;
    warnings: SchemaCheckWarning[] | null;
  } = null;

  if (args.compositionCheck.status === 'failed') {
    compositionErrors.push(...args.compositionCheck.reason.errors);
  }

  if (args.diffCheck.status === 'failed') {
    if (args.diffCheck.reason.changes) {
      schemaChanges = {
        breaking: args.diffCheck.reason.breakingChanges,
        safe: args.diffCheck.reason.safeChanges,
      };
    }

    if (args.diffCheck.reason.compareFailure) {
      compositionErrors.push(args.diffCheck.reason.compareFailure);
    }
  }

  if (args.policyCheck) {
    schemaPolicy = {
      errors: args.policyCheck?.reason?.errors ?? null,
      warnings: args.policyCheck?.reason?.warnings || args.policyCheck?.result?.warnings || null,
    };
  }

  return {
    schemaChanges,
    compositionErrors: compositionErrors.length ? compositionErrors : null,
    schemaPolicy,
  };
}
