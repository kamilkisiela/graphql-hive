import type { IncomingOperation, OperationMap, OperationMapRecord } from './types';
import Ajv from 'ajv';
import type { JSONSchemaType } from 'ajv';

const ajv = new Ajv();

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
    timestamp: { type: 'number', nullable: true },
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
    };
  }

  if (validate(operation)) {
    return {
      valid: true,
    };
  }
  return {
    valid: false,
    errors: validate.errors,
  };
}
