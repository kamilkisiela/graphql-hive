import { createHash, randomUUID } from 'node:crypto';
import type { JSONSchemaType } from 'ajv';
import Ajv from 'ajv';
import { parse } from 'graphql';
import LRU from 'tiny-lru';
import type { ServiceLogger as Logger } from '@hive/service-common';
import { RawReport } from '@hive/usage-common';
import {
  invalidRawOperations,
  rawOperationsSize,
  totalLegacyReports,
  totalOperations,
  totalReports,
} from './metrics';
import type { TokensResponse } from './tokens';

const DAY_IN_MS = 86_400_000;

/**
 * Process Usage for API Version 1
 */
export function usageProcessorV1(
  logger: Logger,
  incomingReport: IncomingReport | IncomingLegacyReport,
  token: TokensResponse,
  targetRetentionInDays: number | null,
): {
  report: RawReport;
  operations: {
    rejected: number;
    accepted: number;
  };
} {
  const now = Date.now();

  const incoming = ensureReportFormat(incomingReport);
  ensureIncomingMessageValidity(incoming);

  const size = incoming.operations.length;
  totalReports.inc();
  totalOperations.inc(size);
  rawOperationsSize.observe(size);

  const report: RawReport = {
    id: randomUUID(),
    target: token.target,
    organization: token.organization,
    size: 0,
    map: {},
    operations: [],
  };

  const oldNewKeyMapping = new Map<string, string>();

  for (const rawKey in incoming.map) {
    const record = incoming.map[rawKey];
    const validationResult = validateOperationMapRecord(record);

    if (validationResult.valid) {
      // The key is used for lru cache (usage-ingestor) so we need to make sure, the record is unique per target, operation body, name and the list of fields
      const key = createHash('md5')
        .update(report.target)
        .update(record.operation)
        .update(record.operationName ?? '')
        .update(JSON.stringify(record.fields.sort()))
        .digest('hex');

      oldNewKeyMapping.set(rawKey, key);

      report.map[key] = {
        key,
        operation: record.operation,
        operationName: record.operationName,
        fields: record.fields,
      };
    }
  }

  for (const operation of incoming.operations) {
    // The validateOperation function drops the operation if the operationMapKey does not exist, we can safely pass the old key in case the new key is missing.
    operation.operationMapKey =
      oldNewKeyMapping.get(operation.operationMapKey) ?? operation.operationMapKey;
    const validationResult = validateOperation(operation, report.map);

    if (validationResult.valid) {
      // Increase size
      report.size += 1;

      // Add operation
      const ts = operation.timestamp ?? now;
      report.operations.push({
        operationMapKey: operation.operationMapKey,
        timestamp: ts,
        expiresAt: targetRetentionInDays ? ts + targetRetentionInDays * DAY_IN_MS : undefined,
        execution: {
          ok: operation.execution.ok,
          duration: operation.execution.duration,
          errorsTotal: operation.execution.errorsTotal,
        },
        metadata: {
          client: {
            name: operation.metadata?.client?.name,
            version: operation.metadata?.client?.version,
          },
        },
      });
    } else {
      logger.warn(
        `Detected invalid operation (target=%s): %o`,
        token.target,
        validationResult.errors,
      );
      invalidRawOperations
        .labels({
          reason:
            'reason' in validationResult && validationResult.reason
              ? validationResult.reason
              : 'unknown',
        })
        .inc(1);
    }
  }

  return {
    report: report,
    operations: {
      accepted: size - report.size,
      rejected: report.size,
    },
  };
}

function ensureIncomingMessageValidity(incoming: Partial<IncomingReport>) {
  if (!incoming || !incoming.operations || !Array.isArray(incoming.operations)) {
    throw new Error('Invalid incoming message');
  }
}

function isLegacyReport(
  report: IncomingReport | IncomingLegacyReport,
): report is IncomingLegacyReport {
  return Array.isArray(report);
}

function ensureReportFormat(report: IncomingLegacyReport | IncomingReport): IncomingReport {
  if (isLegacyReport(report)) {
    totalLegacyReports.inc();
    return convertLegacyReport(report);
  }

  return report;
}

function convertLegacyReport(legacy: IncomingLegacyReport): IncomingReport {
  const hashMap = new Map<string, string>();
  const report: IncomingReport = {
    map: {},
    operations: [],
  };

  for (const op of legacy) {
    let operationMapKey = hashMap.get(op.operation);

    if (!operationMapKey) {
      operationMapKey = createHash('sha256')
        .update(op.operation)
        .update(JSON.stringify(op.fields))
        .digest('hex');
      report.map[operationMapKey] = {
        operation: op.operation,
        operationName: op.operationName,
        fields: op.fields,
      };
    }

    report.operations.push({
      operationMapKey,
      timestamp: op.timestamp,
      execution: {
        ok: op.execution.ok,
        duration: op.execution.duration,
        errorsTotal: op.execution.errorsTotal,
      },
      metadata: {
        client: {
          name: op.metadata?.client?.name,
          version: op.metadata?.client?.version,
        },
      },
    });
  }

  return report;
}

const unixTimestampRegex = /^\d{13,}$/;

function isUnixTimestamp(x: number) {
  return unixTimestampRegex.test(String(x));
}

const ajv = new Ajv({
  formats: {
    unix_timestamp_in_ms: {
      type: 'number',
      validate: isUnixTimestamp,
    },
  },
});

const validOperationBodyCache = LRU<boolean>(5000, 300_000 /* 5 minutes */);

const operationMapRecordSchema: JSONSchemaType<OperationMapRecord> = {
  type: 'object',
  required: ['operation', 'fields'],
  properties: {
    operation: { type: 'string' },
    operationName: { type: 'string', nullable: true },
    fields: { type: 'array', minItems: 1, items: { type: 'string' } },
  },
};

const operationSchema: JSONSchemaType<IncomingOperation> = {
  type: 'object',
  required: ['operationMapKey', 'execution'],
  properties: {
    timestamp: { type: 'number', format: 'unix_timestamp_in_ms', nullable: true },
    operationMapKey: { type: 'string' },
    execution: {
      type: 'object',
      required: ['ok', 'duration', 'errorsTotal'],
      properties: {
        ok: { type: 'boolean' },
        duration: { type: 'number' },
        errorsTotal: { type: 'number' },
      },
    },
    metadata: {
      type: 'object',
      nullable: true,
      required: [],
      properties: {
        client: {
          type: 'object',
          nullable: true,
          required: [],
          properties: {
            name: { type: 'string', nullable: true },
            version: { type: 'string', nullable: true },
          },
        },
      },
    },
  },
};

export function validateOperationMapRecord(record: OperationMapRecord) {
  const validate = ajv.compile(operationMapRecordSchema);

  if (validate(record)) {
    return {
      valid: true,
    };
  }

  return {
    valid: false,
    errors: validate.errors,
  };
}

export function isValidOperationBody(operation: string) {
  const cached = validOperationBodyCache.get(operation);

  if (typeof cached === 'boolean') {
    return cached;
  }

  try {
    parse(operation, {
      noLocation: true,
    });
    validOperationBodyCache.set(operation, true);
    return true;
  } catch (error) {
    validOperationBodyCache.set(operation, false);
    return false;
  }
}

export function validateOperation(operation: IncomingOperation, operationMap: OperationMap) {
  const validate = ajv.compile(operationSchema);

  if (!operationMap[operation.operationMapKey]) {
    return {
      valid: false,
      errors: [
        {
          message: `Operation map key "${operation.operationMapKey}" is not found`,
        },
      ],
      reason: 'operation_map_key_not_found',
    };
  }

  if (validate(operation)) {
    if (!isValidOperationBody(operationMap[operation.operationMapKey].operation)) {
      return {
        valid: false,
        errors: [
          {
            message: 'Failed to parse operation',
          },
        ],
        reason: 'invalid_operation_body',
      };
    }

    return {
      valid: true,
    };
  }

  return {
    valid: false,
    errors: validate.errors,
  };
}

interface IncomingReport {
  map: OperationMap;
  operations: IncomingOperation[];
}

interface OperationMapRecord {
  operation: string;
  operationName?: string | null;
  fields: string[];
}

interface OperationMap {
  [key: string]: OperationMapRecord;
}

type IncomingLegacyReport = LegacyIncomingOperation[];

interface LegacyIncomingOperation {
  timestamp?: number;
  operation: string;
  operationName?: string | null;
  fields: string[];
  execution: {
    ok: boolean;
    duration: number;
    errorsTotal: number;
    errors?: Array<{
      message: string;
      path?: string;
    }>;
  };
  metadata?: {
    client?: {
      name?: string;
      version?: string;
    };
  };
}

interface IncomingOperation {
  operationMapKey: string;
  timestamp?: number;
  execution: {
    ok: boolean;
    duration: number;
    errorsTotal: number;
  };
  metadata?: {
    client?: {
      name?: string;
      version?: string;
    };
  };
}
