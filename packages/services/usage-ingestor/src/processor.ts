import { createHash } from 'crypto';
import type {
  DefinitionNode,
  DocumentNode,
  OperationDefinitionNode,
  OperationTypeNode,
} from 'graphql';
import { Kind, parse } from 'graphql';
import LRU from 'tiny-lru';
import { normalizeOperation as coreNormalizeOperation } from '@graphql-hive/core';
import type { ServiceLogger } from '@hive/service-common';
import type {
  ProcessedOperation,
  RawOperation,
  RawOperationMap,
  RawOperationMapRecord,
  RawReport,
} from '@hive/usage-common';
import { cache, errorOkTuple } from './helpers';
import {
  normalizeCacheMisses,
  reportMessageSize,
  reportSize,
  schemaCoordinatesSize,
  totalOperations,
} from './metrics';
import {
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

export function createProcessor(config: { logger: ServiceLogger }) {
  const { logger } = config;
  const normalize = cache(
    normalizeOperation,
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

      for (const rawReport of rawReports) {
        reportSize.observe(rawReport.size);

        const operationSample = new Map<
          string,
          {
            operation: RawOperation;
            size: number;
          }
        >();

        /** hash -> processedOperations mapping */
        const processedOperationWaitingForInsert = new Map<string, Array<ProcessedOperation>>();
        const hashToOperationTypeMapping = new Map<string, OperationTypeNode>();

        for (const rawOperation of rawReport.operations) {
          const processedOperation = processSingleOperation(
            rawOperation,
            rawReport.map,
            rawReport.target,
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

          let processedOperations = processedOperationWaitingForInsert.get(
            rawOperation.operationMapKey,
          );
          if (processedOperations === undefined) {
            processedOperations = [];
            processedOperationWaitingForInsert.set(
              rawOperation.operationMapKey,
              processedOperations,
            );
          }
          processedOperations.push(processedOperation);
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

          hashToOperationTypeMapping.set(group.operation.operationMapKey, normalized.type);

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
              expires_at: group.operation.expiresAt || timestamp + 30 * DAY_IN_MS,
              timestamp,
            }),
          );
        }

        for (const [hash, processedOperations] of processedOperationWaitingForInsert.entries()) {
          const operationType = hashToOperationTypeMapping.get(hash);
          if (operationType === undefined) {
            logger.warn(`Operation type not found for hash. Skipping insert. hash(=%s)`, hash);
            continue;
          }

          if (operationType === 'subscription') {
            serializedSubscriptionOperations.push(
              ...processedOperations.map(record => stringifySubscriptionOperation(record)),
            );
          } else {
            serializedOperations.push(
              ...processedOperations.map(record => stringifyQueryOrMutationOperation(record)),
            );
          }
        }
      }

      return {
        operations: serializedOperations,
        subscriptionOperations: serializedSubscriptionOperations,
        registryRecords: serializedRegistryRecords,
      };
    },
  };
}

function processSingleOperation(
  operation: RawOperation,
  operationMap: RawOperationMap,
  target: string,
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
    expiresAt: operation.expiresAt || timestamp + 30 * DAY_IN_MS,
    target,
    execution,
    metadata,
    operationHash,
  };
}

function isOperationDef(def: DefinitionNode): def is OperationDefinitionNode {
  return def.kind === Kind.OPERATION_DEFINITION;
}

function normalizeOperation(operation: RawOperationMapRecord) {
  normalizeCacheMisses.inc();
  let parsed: DocumentNode;
  try {
    parsed = parse(operation.operation);
  } catch (error) {
    // No need to log this, it's already logged by the usage service
    // We do check for parse errors here (in addition to the usage service),
    // because the usage service was not parsing the operations before and we got corrupted documents in the Kafka loop.
    return null;
  }

  const body = coreNormalizeOperation({
    document: parsed,
    hideLiterals: true,
    removeAliases: true,
  });

  // Two operations with the same hash has to be equal:
  // 1. body is the same
  // 2. name is the same
  // 3. used schema coordinates are equal - this is important to assign schema coordinate to an operation

  const uniqueCoordinatesSet = new Set<string>();
  for (const field of operation.fields) {
    uniqueCoordinatesSet.add(field);
    // Add types as well:
    // `Query.foo` -> `Query`
    const at = field.indexOf('.');
    if (at > -1) {
      uniqueCoordinatesSet.add(field.substring(0, at));
    }
  }

  const sortedCoordinates = Array.from(uniqueCoordinatesSet).sort();

  const operationDefinition = findOperationDefinition(parsed);

  if (!operationDefinition) {
    return null;
  }

  const operationName = operation.operationName ?? operationDefinition.name?.value;

  const hash = createHash('md5')
    .update(body)
    .update(operationName ?? '')
    .update(sortedCoordinates.join(';')) // we do not need to sort from A to Z, default lexicographic sorting is enough
    .digest('hex');

  return {
    type: operationDefinition.operation,
    hash,
    body,
    coordinates: sortedCoordinates,
    name: operationName || null,
  };
}

function findOperationDefinition(doc: DocumentNode) {
  return doc.definitions.find(isOperationDef);
}
