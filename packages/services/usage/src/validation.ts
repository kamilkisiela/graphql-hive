import type { IncomingOperation, OperationMap, OperationMapRecord } from './types';
import Ajv from 'ajv';
import type { JSONSchemaType } from 'ajv';
import { parse } from 'graphql';
import LRU from 'tiny-lru';

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

function isValidOperationBody(op: OperationMapRecord) {
  const cached = validOperationBodyCache.get(op.operation);

  if (typeof cached === 'boolean') {
    return cached;
  }

  try {
    parse(op.operation, {
      noLocation: true,
    });
    validOperationBodyCache.set(op.operation, true);
    return true;
  } catch (error) {
    validOperationBodyCache.set(op.operation, false);
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
    if (!isValidOperationBody(operationMap[operation.operationMapKey])) {
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
