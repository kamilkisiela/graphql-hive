import { resolveRecordAuditLog } from '../helpers';
import type { OperationInDocumentCollectionCreatedAuditLogResolvers } from './../../../__generated__/types.next';

/*
 * Note: This object type is generated because "OperationInDocumentCollectionCreatedAuditLogMapper" is declared. This is to ensure runtime safety.
 *
 * When a mapper is used, it is possible to hit runtime errors in some scenarios:
 * - given a field name, the schema type's field type does not match mapper's field type
 * - or a schema type's field does not exist in the mapper's fields
 *
 * If you want to skip this file generation, remove the mapper or update the pattern in the `resolverGeneration.object` config.
 */
export const OperationInDocumentCollectionCreatedAuditLog: OperationInDocumentCollectionCreatedAuditLogResolvers =
  {
    __isTypeOf: e => e.event_action === 'OPERATION_IN_DOCUMENT_COLLECTION_CREATED',
    eventTime: e => new Date(e.event_time).toISOString(),
    collectionId: e => e.metadata.operationInDocumentCollectionCreatedAuditLogSchema.collectionId,
    operationId: e => e.metadata.operationInDocumentCollectionCreatedAuditLogSchema.operationId,
    operationQuery: e =>
      e.metadata.operationInDocumentCollectionCreatedAuditLogSchema.operationQuery,
    targetId: e => e.metadata.operationInDocumentCollectionCreatedAuditLogSchema.targetId,
    record: (e, _, { injector }) => resolveRecordAuditLog(e, injector),
    collectionName: e =>
      e.metadata.operationInDocumentCollectionCreatedAuditLogSchema.collectionName,
  };
