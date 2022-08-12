import { normalizeOperation as coreNormalizeOperation } from '@graphql-hive/core';
import { Kind, parse } from 'graphql';
import LRU from 'tiny-lru';
import { createHash } from 'crypto';
import { cache } from './helpers';
import { reportSize, totalOperations, reportMessageSize, normalizeCacheMisses, schemaCoordinatesSize } from './metrics';
import { stringifyOperation, stringifyRegistryRecord } from './serializer';

import type { FastifyLoggerInstance } from '@hive/service-common';
import type {
  RawReport,
  RawOperation,
  RawOperationMap,
  RawOperationMapRecord,
  ProcessedOperation,
} from '@hive/usage-common';
import type { DefinitionNode, DocumentNode, OperationDefinitionNode, OperationTypeNode } from 'graphql';

type NormalizeFunction = (arg: RawOperationMapRecord) => {
  key: string;
  value: {
    type: OperationTypeNode;
    body: string;
    hash: string;
  };
};

const DAY_IN_MS = 86_400_000;

export function createProcessor(config: { logger: FastifyLoggerInstance }) {
  const { logger } = config;
  const normalize = cache(
    normalizeOperation,
    op => op.key,
    LRU<{
      type: OperationTypeNode;
      body: string;
      hash: string;
    }>(10_000, 1_800_000 /* 30 minutes */)
  );

  return {
    async processReports(rawReports: RawReport[]) {
      // Each report has `size` property that tells us the number of operations
      const sizeOfAllReports = rawReports.reduce((acc, r) => acc + r.size, 0);
      reportMessageSize.observe(sizeOfAllReports);
      totalOperations.inc(sizeOfAllReports);

      logger.info(`Processing (reports=%s, operations=%s)`, rawReports.length, sizeOfAllReports);

      // We do it to collect unique operations for the registry table
      const processedRegistryKeys = new Set<string>();
      const serializedOperations: string[] = [];
      const serializedRegistryRecords: string[] = [];

      for (const rawReport of rawReports) {
        reportSize.observe(rawReport.size);

        for (const rawOperation of rawReport.operations) {
          const processedOperation = processSingleOperation(rawOperation, rawReport.map, rawReport.target, normalize);

          serializedOperations.push(stringifyOperation(processedOperation));

          const operationKey = `${processedOperation.operationHash}-${processedOperation.target}`;

          if (!processedRegistryKeys.has(operationKey)) {
            processedRegistryKeys.add(operationKey);
            serializedRegistryRecords.push(
              stringifyRegistryRecord({
                target: processedOperation.target,
                hash: processedOperation.operationHash,
                name: processedOperation.operationName,
                body: processedOperation.document,
                operation: processedOperation.operationType,
                inserted_at: processedOperation.timestamp,
              })
            );
          }
        }
      }

      return {
        operations: serializedOperations,
        registryRecords: serializedRegistryRecords,
      };
    },
  };
}

function processSingleOperation(
  operation: RawOperation,
  operationMap: RawOperationMap,
  target: string,
  normalize: NormalizeFunction
): ProcessedOperation {
  const operationMapRecord = operationMap[operation.operationMapKey];
  const { operationName, fields } = operationMapRecord;
  const { execution, metadata } = operation;

  const { value: normalized } = normalize(operationMapRecord)!;
  const operationHash = normalized.hash ?? 'unknown';

  const unique_fields = new Set<string>();

  for (const field of fields) {
    unique_fields.add(field);
    // `Query.foo` -> `Query`
    const at = field.indexOf('.');
    if (at > -1) {
      unique_fields.add(field.substring(0, at));
    }
  }

  schemaCoordinatesSize.observe(unique_fields.size);

  const timestamp = typeof operation.timestamp === 'string' ? parseInt(operation.timestamp, 10) : operation.timestamp;

  return {
    document: normalized.body,
    timestamp: timestamp,
    expiresAt: operation.expiresAt || timestamp + 30 * DAY_IN_MS,
    operationType: normalized.type,
    fields: Array.from(unique_fields.keys()),
    target,
    execution,
    metadata,
    operationHash,
    operationName,
  };
}

function isOperationDef(def: DefinitionNode): def is OperationDefinitionNode {
  return def.kind === Kind.OPERATION_DEFINITION;
}

function getOperationType(operation: DocumentNode): OperationTypeNode {
  return operation.definitions.find(isOperationDef)!.operation;
}

function normalizeOperation(operation: RawOperationMapRecord) {
  normalizeCacheMisses.inc();
  const parsed = parse(operation.operation);
  const body = coreNormalizeOperation({
    document: parsed,
    hideLiterals: true,
    removeAliases: true,
  });

  const hash = createHash('md5')
    .update(body)
    .update(operation.operationName ?? '')
    .update(operation.fields.sort().join(';')) // we do not need to sort from A to Z, default lexicographic sorting is enough
    .digest('hex');

  return {
    type: getOperationType(parsed),
    hash,
    body,
  };
}
