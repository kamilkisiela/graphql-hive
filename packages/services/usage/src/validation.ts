import { parse } from 'graphql';
import LRU from 'tiny-lru';
import * as tb from '@sinclair/typebox';
import * as tc from '@sinclair/typebox/compiler';
import type {
  IncomingOperation,
  IncomingSubscriptionOperation,
  OperationMap,
  OperationMapRecord,
} from './types';

const validOperationBodyCache = LRU<boolean>(5000, 300_000 /* 5 minutes */);

const OperationMapSchema = tb.Object(
  {
    operation: tb.String(),
    operationName: tb.Optional(tb.String()),
    fields: tb.Array(tb.String(), {
      minItems: 1,
    }),
  },
  { title: 'OperationMapRecord' },
);

const ExecutionSchema = tb.Type.Object(
  {
    ok: tb.Type.Boolean(),
    duration: tb.Type.Integer(),
    errorsTotal: tb.Type.Integer(),
  },
  {
    title: 'Execution',
  },
);

const MetadataSchema = tb.Type.Object({
  client: tb.Type.Optional(
    tb.Union([
      tb.Null(),
      tb.Type.Object(
        {
          name: tb.Type.Optional(tb.Type.String()),
          version: tb.Type.Optional(tb.Type.String()),
        },
        {
          title: 'Client',
        },
      ),
    ]),
  ),
});

/** Query + Mutation */
const RequestOperationSchema = tb.Type.Object(
  {
    timestamp: tb.Type.Optional(tb.Type.Integer()),
    operationMapKey: tb.Type.String(),
    execution: ExecutionSchema,
    metadata: tb.Type.Optional(MetadataSchema),
  },
  {
    title: 'RequestOperation',
  },
);

/** Subscription / Live Query */
const SubscriptionOperationSchema = tb.Type.Object(
  {
    timestamp: tb.Type.Optional(tb.Type.Integer()),
    operationMapKey: tb.Type.String(),
    metadata: tb.Type.Optional(MetadataSchema),
  },
  {
    title: 'SubscriptionOperation',
  },
);

const FullSchema = tb.Type.Object(
  {
    size: tb.Type.Integer(),
    map: tb.Record(tb.String(), OperationMapSchema),
    operations: tb.Array(RequestOperationSchema),
    subscriptionOperations: tb.Array(SubscriptionOperationSchema),
  },
  {
    title: 'Report',
  },
);

const operationMapSchemaModel = tc.TypeCompiler.Compile(OperationMapSchema);
const requestOperationSchemaModel = tc.TypeCompiler.Compile(RequestOperationSchema);
const subscriptionOperationSchemaModel = tc.TypeCompiler.Compile(SubscriptionOperationSchema);

export function validateOperationMapRecord(record: OperationMapRecord) {
  const error = operationMapSchemaModel.Errors(record).First();
  if (!error) {
    return {
      valid: true,
      record: record as tb.Static<typeof OperationMapSchema>,
    } as const;
  }

  return {
    valid: false,
  } as const;
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

export function validateRequestOperation(operation: IncomingOperation, operationMap: OperationMap) {
  const errors = [...requestOperationSchemaModel.Errors(operation)];

  if (errors.length) {
    return {
      valid: false,
      errors,
    } as const;
  }

  if (!operationMap[operation.operationMapKey]) {
    return {
      valid: false,
      errors: [
        {
          message: `Operation map key "${operation.operationMapKey}" is not found`,
        },
      ],
      reason: 'operation_map_key_not_found',
    } as const;
  }

  if (!isValidOperationBody(operationMap[operation.operationMapKey])) {
    return {
      valid: false,
      errors: [
        {
          message: 'Failed to parse operation',
        },
      ],
      reason: 'invalid_operation_body',
    } as const;
  }

  return {
    valid: true,
    operation: operation as tb.Static<typeof RequestOperationSchema>,
    operationMapRecord: operationMap[operation.operationMapKey] as tb.Static<
      typeof OperationMapSchema
    >,
  } as const;
}

export function validateSubscriptionOperation(
  operation: IncomingSubscriptionOperation,
  operationMap: OperationMap,
) {
  const errors = [...subscriptionOperationSchemaModel.Errors(operation)];

  if (errors.length) {
    return {
      valid: false,
      errors,
    } as const;
  }

  if (!operationMap[operation.operationMapKey]) {
    return {
      valid: false,
      errors: [
        {
          message: `Operation map key "${operation.operationMapKey}" is not found`,
        },
      ],
      reason: 'operation_map_key_not_found',
    } as const;
  }

  if (!isValidOperationBody(operationMap[operation.operationMapKey])) {
    return {
      valid: false,
      errors: [
        {
          message: 'Failed to parse operation',
        },
      ],
      reason: 'invalid_operation_body',
    } as const;
  }

  return {
    valid: true,
    operation: operation as tb.Static<typeof SubscriptionOperationSchema>,
    operationMapRecord: operationMap[operation.operationMapKey] as tb.Static<
      typeof OperationMapSchema
    >,
  } as const;
}
