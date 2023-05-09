import type { SchemaPolicyApi } from '@hive/policy';
import { TRPCClientError } from '@trpc/client';
import { RuleInstanceSeverityLevel, SchemaPolicyInput } from '../../__generated__/types';

export function formatTRPCErrors(e: TRPCClientError<SchemaPolicyApi>) {
  if (e.data?.zodError) {
    return {
      error: {
        __typename: 'UpdateSchemaPolicyResultError' as const,
        message: e.data.formatted || e.message,
        code: 'VALIDATION_ERROR',
      },
    };
  }

  return {
    error: {
      __typename: 'UpdateSchemaPolicyResultError' as const,
      message: e.message,
    },
  };
}

export function parseSeverity(severity: RuleInstanceSeverityLevel): number {
  switch (severity) {
    case 'ERROR':
      return 2;
    case 'WARNING':
      return 1;
    case 'OFF':
      return 0;
  }
}

export function serializeSeverity(value: string | number): RuleInstanceSeverityLevel {
  switch (value) {
    case 0:
    case 'off':
    case 'OFF':
      return 'OFF';
    case 1:
    case 'warn':
    case 'WARN':
      return 'WARNING';
    case 2:
    case 'error':
    case 'ERROR':
      return 'ERROR';
    default:
      throw new Error(`Invalid severity level: ${value}`);
  }
}

export function policyInputToConfigObject(policy: SchemaPolicyInput) {
  return policy.rules.reduce(
    (acc, r) => ({
      ...acc,
      [r.ruleId]: r.configuration
        ? [parseSeverity(r.severity), r.configuration]
        : [parseSeverity(r.severity)],
    }),
    {},
  );
}
