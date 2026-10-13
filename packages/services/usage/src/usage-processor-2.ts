import { createHash, randomUUID } from 'node:crypto';
import { LRUCache } from 'lru-cache';
import { ServiceLogger as Logger, traceInlineSync } from '@hive/service-common';
import type {
  ClientMetadata,
  RawOperation,
  RawOperationErrors,
  RawReport,
  RawSubscriptionOperation,
} from '@hive/usage-common';
import * as tb from '@sinclair/typebox';
import * as tc from '@sinclair/typebox/compiler';
import * as tbe from '@sinclair/typebox/errors';
import { invalidRawOperations, rawOperationsSize, totalOperations, totalReports } from './metrics';
import { isValidOperationBody } from './usage-processor-1';

interface OperationMapKeyEntry {
  /** md5(targetId, document, operation name and the sorted fields) */
  hash: string;
  /** Sorted, so field order never affects identity. Also what Kafka carries. */
  sortedFields: string[];
}

/**
 * The idea here is to reuse operation map keys across requests,
 * so we can skip sorting and stringifying the field list, and hashing the whole document.
 */
const operationMapKeyCache = new LRUCache<string, Map<string, OperationMapKeyEntry[]>>({
  // We're using `maxSize` instead of `max`, because the stored Map can have 1 record or 1000s,
  // and we want to cap the total memory used by the cache, not just the number of entries.
  maxSize: 200 * 1024 * 1024, // 200MB
  sizeCalculation: (byTarget, document) => {
    // Yeah yeah, magic numbers, but I ran a bunch of different-sized reports to get those numbers
    // and they roughtly represent 1:1 the memory footprint of the stored records in the cache.
    let size = document.length + 1024; // The cost of Map, the LRU's own node, and the key
    for (const entries of byTarget.values()) {
      for (const entry of entries) {
        size += 128; // md5 and stuff
        for (const field of entry.sortedFields) {
          size += field.length;
        }
      }
    }
    return size;
  },
});

function sameFields(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

function operationMapSlot(record: OperationMapRecord): Map<string, OperationMapKeyEntry[]> | null {
  const cached = operationMapKeyCache.get(record.operation);
  if (cached) {
    return cached;
  }
  if (!isValidOperationBody(record.operation)) {
    return null;
  }
  return new Map();
}

function buildOperationMapKeyEntry(
  targetId: string,
  record: OperationMapRecord,
  sortedFields: string[],
): OperationMapKeyEntry {
  return {
    sortedFields,
    hash: createHash('md5')
      .update(targetId)
      .update(record.operation)
      .update(record.operationName ?? '')
      .update(JSON.stringify(sortedFields))
      .digest('hex'),
  };
}

function deriveOperationMapKey(
  targetId: string,
  record: OperationMapRecord,
): OperationMapKeyEntry | null {
  const byTarget = operationMapSlot(record);
  if (byTarget === null) {
    return null;
  }

  const sortedFields = record.fields.toSorted();

  const entries = byTarget.get(targetId);
  const cached = entries?.find(entry => sameFields(entry.sortedFields, sortedFields));
  if (cached) {
    return cached;
  }

  const entry = buildOperationMapKeyEntry(targetId, record, sortedFields);
  if (entries) {
    entries.push(entry);
  } else {
    byTarget.set(targetId, [entry]);
  }

  // Re-set so the LRU recalculates the size
  operationMapKeyCache.set(record.operation, byTarget);
  return entry;
}

export const usageProcessorV2 = traceInlineSync(
  'usageProcessorV2',
  {
    initAttributes: (_logger, _incomingReport, token) => ({
      'hive.input.targetId': token.targetId,
      'hive.input.projectId': token.projectId,
      'hive.input.organizationId': token.organizationId,
    }),
    resultAttributes: result => ({
      'hive.result.success': result.success,
      'hive.result.reportId': result.success ? result.report.id : undefined,
      'hive.result.operations.accepted': result.success ? result.operations.accepted : undefined,
      'hive.result.operations.rejected': result.success ? result.operations.rejected : undefined,
      'hive.result.error.count': result.success ? undefined : result.errors.length,
    }),
  },
  (
    logger: Logger,
    incomingReport: unknown,
    targetSelector: {
      targetId: string;
      projectId: string;
      organizationId: string;
    },
    targetRetentionInDays: number | null,
  ):
    | { success: false; errors: Array<ValueError> }
    | {
        success: true;
        report: RawReport;
        operations: {
          rejected: number;
          accepted: number;
        };
      } => {
    logger = logger.child({ source: 'usageProcessorV2' });
    const reportResult = decodeReport(incomingReport);

    if (reportResult.success === false) {
      return {
        success: false,
        errors: reportResult.errors,
      };
    }

    const incoming = reportResult.report;

    const incomingOperations = incoming.operations ?? [];
    const incomingSubscriptionOperations = incoming.subscriptionOperations ?? [];

    const size = incomingOperations.length + incomingSubscriptionOperations.length;
    totalReports.inc();
    totalOperations.inc(size);
    rawOperationsSize.observe(size);

    const rawOperations: RawOperation[] = [];
    const rawErrors: RawOperationErrors[] = [];
    const rawSubscriptionOperations: RawSubscriptionOperation[] = [];

    const lastAppDeploymentUsage = new Map<`${string}/${string}`, number>();

    function upsertClientUsageTimestamp(
      clientName: string,
      clientVersion: string,
      timestamp: number,
    ) {
      const key = `${clientName}/${clientVersion}` as const;
      let latestTimestamp = lastAppDeploymentUsage.get(key);
      if (!latestTimestamp || timestamp > latestTimestamp) {
        lastAppDeploymentUsage.set(key, timestamp);
      }
    }

    const report: RawReport = {
      id: randomUUID(),
      target: targetSelector.targetId,
      organization: targetSelector.organizationId,
      size: 0,
      map: {},
      operations: rawOperations,
      subscriptionOperations: rawSubscriptionOperations,
    };

    const newKeyMappings = new Map<OperationMapRecord, string>();

    function getOperationMapRecordKey(operationMapKey: string): string | null {
      const operationMapRecord = incoming.map[operationMapKey] as OperationMapRecord | undefined;

      if (!operationMapRecord) {
        logger.warn(
          `Detected invalid operation. Operation map key could not be found. (target=%s): %s`,
          targetSelector.targetId,
          operationMapKey,
        );
        invalidRawOperations
          .labels({
            reason: 'operation_map_key_not_found',
          })
          .inc(1);
        return null;
      }

      let newOperationMapKey = newKeyMappings.get(operationMapRecord);

      if (newOperationMapKey === undefined) {
        const key = deriveOperationMapKey(targetSelector.targetId, operationMapRecord);

        if (key === null) {
          logger.warn(
            `Detected invalid operation (target=%s): %s`,
            targetSelector.targetId,
            operationMapKey,
          );
          invalidRawOperations
            .labels({
              reason: 'invalid_operation_body',
            })
            .inc(1);
          return null;
        }

        newOperationMapKey = key.hash;

        report.map[newOperationMapKey] = {
          key: newOperationMapKey,
          operation: operationMapRecord.operation,
          operationName: operationMapRecord.operationName,
          fields: key.sortedFields,
        };

        newKeyMappings.set(operationMapRecord, newOperationMapKey);
      }

      return newOperationMapKey;
    }

    for (const operation of incomingOperations) {
      const operationMapKey = getOperationMapRecordKey(operation.operationMapKey);

      // if the record does not exist -> skip the operation
      if (operationMapKey === null) {
        continue;
      }

      let client: ClientMetadata | undefined;
      if (operation.persistedDocumentHash) {
        const [name, version] = operation.persistedDocumentHash.split('~');
        client = {
          name,
          version,
        };
        upsertClientUsageTimestamp(name, version, operation.timestamp);
      } else {
        client = operation.metadata?.client ?? undefined;
      }

      report.size += 1;
      rawOperations.push({
        operationMapKey,
        timestamp: operation.timestamp,
        expiresAt: targetRetentionInDays
          ? operation.timestamp + targetRetentionInDays * DAY_IN_MS
          : undefined,
        execution: {
          ok: operation.execution.ok,
          duration: operation.execution.duration,
          errorsTotal: operation.execution.errorsTotal,
          coordinateTotals: sumMap(operation.execution.fetches?.map(f => f.fields) ?? []),
        },
        metadata: {
          client,
          graph: {
            graphId: operation.metadata?.graph?.graphId,
            graphVersionId: operation.metadata?.graph?.graphVersionId,
          },
        },
      });

      let errors = operation.execution.fetches?.flatMap(f => f.errors).filter(e => e !== undefined);
      if (operation.execution.gatewayErrors?.length) {
        // append gateway errors onto the reported rawErrors.
        if (!errors?.length) {
          errors = operation.execution.gatewayErrors;
        } else {
          errors.push(...operation.execution.gatewayErrors);
        }
      }
      if (errors?.length) {
        rawErrors.push({
          operationMapKey,
          timestamp: operation.timestamp,
          expiresAt: targetRetentionInDays
            ? operation.timestamp + targetRetentionInDays * DAY_IN_MS
            : undefined,
          errors,
        });
        report.errors ??= rawErrors;
      }
    }

    for (const operation of incomingSubscriptionOperations) {
      const operationMapKey = getOperationMapRecordKey(operation.operationMapKey);

      // if the record does not exist -> skip the operation
      if (operationMapKey === null) {
        continue;
      }

      let client: ClientMetadata | undefined;
      if (operation.persistedDocumentHash) {
        const [name, version] = operation.persistedDocumentHash.split('~');
        client = {
          name,
          version,
        };
        upsertClientUsageTimestamp(name, version, operation.timestamp);
      } else {
        client = operation.metadata?.client ?? undefined;
      }

      report.size += 1;
      rawSubscriptionOperations.push({
        operationMapKey,
        timestamp: operation.timestamp,
        expiresAt: targetRetentionInDays
          ? operation.timestamp + targetRetentionInDays * DAY_IN_MS
          : undefined,
        metadata: {
          client,
          graph: {
            graphId: operation.metadata?.graph?.graphId,
            graphVersionId: operation.metadata?.graph?.graphVersionId,
          },
        },
      });
    }

    if (lastAppDeploymentUsage.size) {
      report.appDeploymentUsageTimestamps = Object.fromEntries(lastAppDeploymentUsage);
    }

    return {
      success: true,
      report,
      operations: {
        rejected: size - report.size,
        accepted: report.size,
      },
    };
  },
);

// The idea behind this function is to make sure we use Optional on top of the Union.
// If the order is different, the field will be required.
//
// Instead of creating `Nullable` helper type, that could be used in property definitions,
// I decided to create `OptionalAndNullable` to prevent people making the mistake I mentioned.
const OptionalAndNullable = <T extends tb.TSchema>(schema: T) =>
  // Makes the field optional
  tb.Optional(
    // Either `null` or `T` is accepted
    tb.Type.Union([schema, tb.Type.Null()]),
  );

const OperationMapRecordSchema = tb.Object(
  {
    operation: tb.String(),
    operationName: OptionalAndNullable(tb.String()),
    fields: tb.Array(tb.String(), {
      minItems: 1,
    }),
  },
  { title: 'OperationMapRecord', additionalProperties: false },
);

type OperationMapRecord = tb.Static<typeof OperationMapRecordSchema>;

const TrackedErrorSchema = tb.Object(
  { coordinate: tb.String(), code: tb.Optional(tb.String()) },
  {
    title: 'TrackedError',
    description:
      'Error for a schema coordinate, with the code returned from the GraphQL extensions.',
  },
);

const SubgraphRequestSchema = tb.Object(
  {
    start: tb.Integer({
      description: 'Delta start time from "timestamp". Unsigned 64-bit integer, capped at 2^63.',
      minimum: 0,
      maximum: Math.pow(2, 63),
    }),

    duration: tb.Integer({
      description: 'How long the request took. Unsigned 64-bit integer, capped at 2^63.',
      minimum: 0,
      maximum: Math.pow(2, 63),
    }),

    status: tb.Optional(
      tb.Integer({
        description: 'HTTP status code.',
        minimum: 0,
        maximum: 599,
      }),
    ),

    fields: tb.Record(tb.String(), tb.Number(), {
      description:
        'Number of times each field has been requested, regardless of success or failure.',
    }),

    errors: tb.Optional(tb.Array(TrackedErrorSchema)),

    subgraph: tb.String({ description: 'Which subgraph resolved this path.' }),

    paths: tb.Union([tb.String(), tb.Array(tb.String(), { minItems: 1 })], {
      description:
        'If this is an entity request, the coordinate in the original operation that is being resolved. ' +
        "If undefined, the path is assumed to be 'Query'.",
    }),

    type: tb.Union([tb.Literal('ROOT'), tb.Literal('ENTITY')], {
      description:
        'ROOT if resolving a root query/mutation field, ENTITY if resolving an entity type in federation.',
    }),
  },
  {
    title: 'SubgraphRequest',
    additionalProperties: false,
  },
);

const ExecutionSchema = tb.Type.Object(
  {
    ok: tb.Type.Boolean(),
    duration: tb.Type.Integer({
      description: 'How long the operation took. Unsigned 64-bit integer, capped at 2^63.',
      // https://clickhouse.com/docs/en/sql-reference/data-types/int-uint
      minimum: 0,
      // Maximum value is 18_446_744_073_709_551_615, but we stick to Math.pow(2, 63).
      // Using 2^64 in JS is problematic and 2^63 is more than enough.
      maximum: Math.pow(2, 63),
    }),
    errorsTotal: tb.Type.Integer({
      // https://clickhouse.com/docs/en/sql-reference/data-types/int-uint
      minimum: 0,
      maximum: Math.pow(2, 16) - 1,
    }),
    fetches: OptionalAndNullable(tb.Array(SubgraphRequestSchema)),
    gatewayErrors: OptionalAndNullable(tb.Array(TrackedErrorSchema)),
  },
  {
    title: 'Execution',
    additionalProperties: false,
  },
);

const ClientSchema = tb.Type.Object(
  {
    name: tb.Type.String(),
    version: tb.Type.String(),
  },
  {
    title: 'Client',
    additionalProperties: false,
  },
);

const UUIDType = tb.Type.String({ format: 'uuid' });

const GraphSchema = tb.Type.Object(
  {
    graphId: UUIDType,
    graphVersionId: UUIDType,
  },
  {
    title: 'Graph',
    additionalProperties: false,
  },
);

const MetadataSchema = tb.Type.Object(
  {
    client: OptionalAndNullable(ClientSchema),
    graph: OptionalAndNullable(GraphSchema),
  },
  {
    title: 'Metadata',
    additionalProperties: false,
  },
);

const PersistedDocumentHash = tb.Type.String({
  title: 'PersistedDocumentHash',
  description: 'Persisted document identifier in the format "appName~appVersion~hash".',
  pattern: '^[a-zA-Z0-9_-]{1,64}~[a-zA-Z0-9._-]{1,64}~([A-Za-z]|[0-9]|_){1,128}$',
});

export function isUnixTimestamp(x: number) {
  return Number.isInteger(x) && x >= 1e12;
}

tbe.SetErrorFunction(param => {
  return param.schema[tb.Kind] === 'UnixTimestampInMs'
    ? 'Expected valid unix timestamp in milliseconds'
    : tbe.DefaultErrorFunction(param);
});

tb.TypeRegistry.Set<number>('UnixTimestampInMs', (_, value) =>
  typeof value === 'number' ? isUnixTimestamp(value) : false,
);

const UnixTimestampInMs = tb.Type.Unsafe<number>({
  [tb.Kind]: 'UnixTimestampInMs',
  description: 'Unix timestamp in milliseconds.',
});

const RequestOperationSchema = tb.Type.Object(
  {
    timestamp: UnixTimestampInMs,
    operationMapKey: tb.Type.String(),
    execution: ExecutionSchema,
    metadata: OptionalAndNullable(MetadataSchema),
    persistedDocumentHash: OptionalAndNullable(PersistedDocumentHash),
  },
  {
    title: 'RequestOperation',
    description: 'Query or mutation operation.',
    additionalProperties: false,
  },
);

const SubscriptionOperationSchema = tb.Type.Object(
  {
    timestamp: UnixTimestampInMs,
    operationMapKey: tb.Type.String(),
    metadata: OptionalAndNullable(MetadataSchema),
    persistedDocumentHash: OptionalAndNullable(PersistedDocumentHash),
  },
  {
    title: 'SubscriptionOperation',
    description: 'Subscription or live query operation.',
    additionalProperties: false,
  },
);

export const ReportSchema = tb.Type.Object(
  {
    size: tb.Type.Integer({
      minimum: 1,
    }),
    map: tb.Record(tb.String(), OperationMapRecordSchema),
    operations: OptionalAndNullable(tb.Array(RequestOperationSchema)),
    subscriptionOperations: OptionalAndNullable(tb.Array(SubscriptionOperationSchema)),
  },
  {
    title: 'Report',
    additionalProperties: false,
  },
);

type ReportType = tb.Static<typeof ReportSchema>;

const ReportModel = tc.TypeCompiler.Compile(ReportSchema);

interface ValueError {
  path: string;
  message: string;
  errors?: ValueError[];
}

export function decodeReport(
  report: unknown,
): { success: true; report: ReportType } | { success: false; errors: Array<ValueError> } {
  // Check() short-circuits on the first failure,
  // where Errors() walk the whole document building error objects.
  // We only pay for Errors() when it is invalid.
  if (ReportModel.Check(report)) {
    return {
      success: true,
      report: report as ReportType,
    };
  }

  return {
    success: false,
    errors: getTypeBoxErrors(ReportModel.Errors(report)),
  };
}

function getTypeBoxErrors(errors: tc.ValueErrorIterator): Array<ValueError> {
  return Array.from(errors).map(error => {
    const errors = error.errors.flatMap(errors => getTypeBoxErrors(errors));
    return {
      path: error.path,
      message: error.message,
      errors: errors.length ? errors : undefined,
    };
  });
}

function sumMap(records: { [key: string]: number }[]): { [key: string]: number } | undefined {
  if (records.length <= 1) {
    return records[0];
  }

  const out = {
    ...records[0],
  };
  const [_, ...remainingRecords] = records;
  for (const record of remainingRecords) {
    for (const key of Object.keys(record)) {
      out[key] = (out[key] ?? 0) + record[key];
    }
  }
  return out;
}

const DAY_IN_MS = 86_400_000;
