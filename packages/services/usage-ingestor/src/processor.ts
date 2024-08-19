import type { OperationTypeNode } from 'graphql';
import LRU from 'tiny-lru';
import type { ServiceLogger } from '@hive/service-common';
import type {
  ProcessedOperation,
  RawAppDeploymentUsageTimestampMap,
  RawOperation,
  RawOperationMap,
  RawOperationMapRecord,
  RawReport,
  RawSubscriptionOperation,
} from '@hive/usage-common';
import { cache, errorOkTuple } from './helpers';
import {
  normalizeCacheMisses,
  reportMessageSize,
  reportSize,
  schemaCoordinatesSize,
  totalOperations,
} from './metrics';
import { normalizeOperation } from './normalize-operation';
import {
  stringifyAppDeploymentUsageRecord,
  stringifyQueryOrMutationOperation,
  stringifyRegistryRecord,
  stringifySubscriptionOperation,
} from './serializer';

interface NormalizationResult {
  type: OperationTypeNode;
  name: string | null;
  body: string;
  hash: string;
  coordinates: string[];
}
type NormalizeFunction = (arg: RawOperationMapRecord) => {
  key: string;
  value: NormalizationResult | null;
};

const DAY_IN_MS = 86_400_000;
const RETENTION_FALLBACK = 365;

export function createProcessor(config: { logger: ServiceLogger }) {
  const { logger } = config;
  const normalize = cache(
    (operation: RawOperationMapRecord) => {
      normalizeCacheMisses.inc();
      return normalizeOperation({
        document: operation.operation,
        fields: operation.fields,
        operationName: operation.operationName ?? null,
      });
    },
    op => op.key,
    LRU<NormalizationResult>(10_000, 1_800_000 /* 30 minutes */),
  );

  return {
    async processReports(rawReports: RawReport[]) {
      // Each report has `size` property that tells us the number of operations
      const sizeOfAllReports = rawReports.reduce((acc, r) => acc + r.size, 0);
      reportMessageSize.observe(sizeOfAllReports);
      totalOperations.inc(sizeOfAllReports);

      logger.info(`Processing (reports=%s, operations=%s)`, rawReports.length, sizeOfAllReports);

      const serializedOperations: string[] = [];
      const serializedSubscriptionOperations: string[] = [];
      const serializedRegistryRecords: string[] = [];

      const allAppDeploymentTimeStamps = new Map<
        string,
        Array<RawAppDeploymentUsageTimestampMap>
      >();

      for (const rawReport of rawReports) {
        reportSize.observe(rawReport.size);

        if (rawReport.appDeploymentUsageTimestamps) {
          let targetRecords = allAppDeploymentTimeStamps.get(rawReport.target);
          if (!targetRecords) {
            targetRecords = [];
            allAppDeploymentTimeStamps.set(rawReport.target, targetRecords);
          }
          targetRecords.push(rawReport.appDeploymentUsageTimestamps);
        }

        const operationSample = new Map<
          string,
          {
            operation: RawOperation | RawSubscriptionOperation;
            size: number;
          }
        >();

        for (const rawOperation of rawReport.operations) {
          const processedOperation = processSingleOperation(
            rawOperation,
            rawReport.map,
            rawReport.target,
            rawReport.organization,
            normalize,
            logger,
          );

          if (processedOperation === null) {
            // The operation should be ignored
            continue;
          }

          const sample = operationSample.get(rawOperation.operationMapKey);

          // count operations per operationMapKey
          if (!sample) {
            operationSample.set(rawOperation.operationMapKey, {
              operation: rawOperation,
              size: 1,
            });
          } else {
            sample.size += 1;
          }

          serializedOperations.push(stringifyQueryOrMutationOperation(processedOperation));
        }

        if (rawReport.subscriptionOperations) {
          for (const rawOperation of rawReport.subscriptionOperations) {
            const processedOperation = processSubscriptionOperation(
              rawOperation,
              rawReport.map,
              rawReport.target,
              rawReport.organization,
              normalize,
              logger,
            );

            if (processedOperation === null) {
              // The operation should be ignored
              continue;
            }

            const sample = operationSample.get(rawOperation.operationMapKey);

            // count operations per operationMapKey
            if (!sample) {
              operationSample.set(rawOperation.operationMapKey, {
                operation: rawOperation,
                size: 1,
              });
            } else {
              sample.size += 1;
            }

            serializedSubscriptionOperations.push(
              stringifySubscriptionOperation(processedOperation),
            );
          }
        }

        for (const group of operationSample.values()) {
          const operationMapRecord = rawReport.map[group.operation.operationMapKey];

          if (!operationMapRecord) {
            logger.warn(`Operation map record not found key=%s`, group.operation.operationMapKey);
            continue;
          }

          const { value: normalized } = normalize(operationMapRecord);

          if (normalized === null) {
            // The operation should be ignored
            continue;
          }

          const operationHash = normalized.hash ?? 'unknown';
          const timestamp =
            typeof group.operation.timestamp === 'string'
              ? parseInt(group.operation.timestamp, 10)
              : group.operation.timestamp;

          serializedRegistryRecords.push(
            stringifyRegistryRecord({
              size: group.size,
              target: rawReport.target,
              hash: operationHash,
              name: operationMapRecord.operationName ?? normalized.name,
              body: normalized.body,
              operation_kind: normalized.type,
              coordinates: normalized.coordinates,
              expires_at: group.operation.expiresAt || timestamp + RETENTION_FALLBACK * DAY_IN_MS,
              timestamp,
            }),
          );
        }
      }

      const serializedAppDeploymentUsageRecords: string[] = [];

      if (allAppDeploymentTimeStamps.size > 0) {
        for (const [target, records] of allAppDeploymentTimeStamps) {
          const max = new Map<string, number>();
          for (const record of records) {
            for (const key in record) {
              let current = max.get(key);
              if (!current || current < record[key]) {
                max.set(key, record[key]);
              }
            }
          }

          for (const [key, timestamp] of max.entries()) {
            const [appName, appVersion] = key.split('/');
            serializedAppDeploymentUsageRecords.push(
              stringifyAppDeploymentUsageRecord({
                target,
                appName,
                appVersion,
                lastRequestTimestamp: timestamp,
              }),
            );
          }
        }
      }

      return {
        operations: serializedOperations,
        subscriptionOperations: serializedSubscriptionOperations,
        registryRecords: serializedRegistryRecords,
        appDeploymentUsageRecords: serializedAppDeploymentUsageRecords,
      };
    },
  };
}

function processSingleOperation(
  operation: RawOperation,
  operationMap: RawOperationMap,
  target: string,
  organization: string,
  normalize: NormalizeFunction,
  logger: ServiceLogger,
): ProcessedOperation | null {
  const operationMapRecord = operationMap[operation.operationMapKey];
  const { execution, metadata } = operation;

  const [normalizationError, normalizationResult] = errorOkTuple(() =>
    normalize(operationMapRecord),
  );

  if (!normalizationResult) {
    // Failed to normalize the operation because of an exception
    logger.debug(
      'Failed to normalize operation (operationName=%s, operation=%s)',
      operationMapRecord.operationName ?? '-',
      operationMapRecord.operation,
    );
    logger.error(normalizationError);
    return null;
  }

  const { value: normalized } = normalizationResult;

  if (normalized === null) {
    // The operation should be ignored
    return null;
  }

  const operationHash = normalized.hash ?? 'unknown';

  schemaCoordinatesSize.observe(normalized.coordinates.length);

  const timestamp =
    typeof operation.timestamp === 'string'
      ? parseInt(operation.timestamp, 10)
      : operation.timestamp;

  return {
    timestamp,
    expiresAt: operation.expiresAt || timestamp + RETENTION_FALLBACK * DAY_IN_MS,
    target,
    organization,
    execution,
    metadata,
    operationHash,
  };
}

function processSubscriptionOperation(
  operation: RawSubscriptionOperation,
  operationMap: RawOperationMap,
  target: string,
  organization: string,
  normalize: NormalizeFunction,
  logger: ServiceLogger,
) {
  const operationMapRecord = operationMap[operation.operationMapKey];
  const { metadata } = operation;

  const [normalizationError, normalizationResult] = errorOkTuple(() =>
    normalize(operationMapRecord),
  );

  if (!normalizationResult) {
    // Failed to normalize the operation because of an exception
    logger.debug(
      'Failed to normalize operation (operationName=%s, operation=%s)',
      operationMapRecord.operationName ?? '-',
      operationMapRecord.operation,
    );
    logger.error(normalizationError);
    return null;
  }

  const { value: normalized } = normalizationResult;

  if (normalized === null) {
    // The operation should be ignored
    return null;
  }

  const operationHash = normalized.hash ?? 'unknown';

  schemaCoordinatesSize.observe(normalized.coordinates.length);

  const timestamp =
    typeof operation.timestamp === 'string'
      ? parseInt(operation.timestamp, 10)
      : operation.timestamp;

  return {
    timestamp,
    expiresAt: operation.expiresAt || timestamp + RETENTION_FALLBACK * DAY_IN_MS,
    target,
    organization,
    metadata,
    operationHash,
  };
}
