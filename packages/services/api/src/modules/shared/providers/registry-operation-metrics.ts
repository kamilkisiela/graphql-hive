import promClient from 'prom-client';
import { getErrorSource } from '@hive/service-common';

export const registryOperationOutcomeCount = new promClient.Counter({
  name: 'registry_operation_outcome_count',
  help: 'Number of completed registry operations by outcome. Only unexpected errors are treated as failures; requests aborted by the client are counted as aborted.',
  labelNames: ['operation', 'conclusion'],
});

export const registryOperationUnexpectedErrorCount = new promClient.Counter({
  name: 'registry_operation_unexpected_error_count',
  help: 'Unexpected, not gracefully handled registry operation errors.',
  labelNames: ['operation', 'source'],
});

export function unexpectedErrorMetricLabels(operation: string, error: unknown) {
  return {
    operation,
    source: getErrorSource(error) ?? 'unknown',
  };
}
