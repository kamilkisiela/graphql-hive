import {
  PushedCompositeSchema,
  SchemaCompositionError,
  SingleSchema,
} from 'packages/services/api/src/shared/entities';
import { Change } from '@graphql-inspector/core';
import type { CheckPolicyResponse } from '@hive/policy';

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
  MissingServiceUrl: 'MISSING_SERVICE_URL',
  MissingServiceName: 'MISSING_SERVICE_NAME',
  CompositionFailure: 'COMPOSITION_FAILURE',
  BreakingChanges: 'BREAKING_CHANGES',
  PolicyInfringement: 'POLICY_INFRINGEMENT',
} as const;

export type CheckFailureReasonCode =
  (typeof CheckFailureReasonCode)[keyof typeof CheckFailureReasonCode];

export type CheckPolicyResultRecord = CheckPolicyResponse[number] | { message: string };
export type SchemaCheckWarning = {
  message: string;
  source: string;

  line?: number;
  column?: number;
};

export type SchemaCheckFailureReason =
  | {
      code: (typeof CheckFailureReasonCode)['MissingServiceName'];
    }
  | {
      code: (typeof CheckFailureReasonCode)['CompositionFailure'];
      compositionErrors: Array<{
        message: string;
      }>;
    }
  | {
      code: (typeof CheckFailureReasonCode)['BreakingChanges'];
      breakingChanges: Array<Change>;
      changes: Array<Change>;
    }
  | {
      code: (typeof CheckFailureReasonCode)['PolicyInfringement'];
      errors: Array<{
        message: string;
      }>;
    };

export type SchemaCheckSuccess = {
  conclusion: (typeof SchemaCheckConclusion)['Success'];
  state: {
    changes: Array<Change> | null;
    warnings: SchemaCheckWarning[] | null;
    initial: boolean;
  };
};

export type SchemaCheckFailure = {
  conclusion: (typeof SchemaCheckConclusion)['Failure'];
  reasons: SchemaCheckFailureReason[];
  warnings: SchemaCheckWarning[] | null;
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
      compositionErrors: Array<{
        message: string;
      }>;
    };

export type SchemaDeleteSuccess = {
  conclusion: (typeof SchemaDeleteConclusion)['Accept'];
  state: {
    composable: boolean;
    changes: Array<Change> | null;
    breakingChanges: Array<Change> | null;
    compositionErrors: Array<{
      message: string;
    }> | null;
  };
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

export function getReasonByCode<
  T extends {
    reasons: { code: string }[];
  },
  R extends T['reasons'][number]['code'],
>(failure: T, code: R): ReasonOf<T['reasons'], R> | undefined {
  return failure.reasons.find(r => r.code === code) as any;
}

export const temp = 'temp';

export function formatPolicyMessage(record: CheckPolicyResultRecord): string {
  if ('ruleId' in record) {
    return `${record.message} (source: policy-${record.ruleId})`;
  }

  return record.message;
}
