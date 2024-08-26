import { resolveRecordAuditLog } from '../helpers';
import type { OperationInDocumentCollectionDeletedAuditLogResolvers } from './../../../__generated__/types.next';

/*
 * Note: This object type is generated because "OperationInDocumentCollectionDeletedAuditLogMapper" is declared. This is to ensure runtime safety.
 *
 * When a mapper is used, it is possible to hit runtime errors in some scenarios:
 * - given a field name, the schema type's field type does not match mapper's field type
 * - or a schema type's field does not exist in the mapper's fields
 *
 * If you want to skip this file generation, remove the mapper or update the pattern in the `resolverGeneration.object` config.
 */
export const OperationInDocumentCollectionDeletedAuditLog: OperationInDocumentCollectionDeletedAuditLogResolvers =
  {
    __isTypeOf: e => e.event_action === 'OPERATION_IN_DOCUMENT_COLLECTION_DELETED',
    eventTime: e => new Date(e.event_time).toISOString(),
    collectionId: e => e.metadata.operationInDocumentCollectionDeletedAuditLogSchema.collectionId,
    collectionName: e =>
      e.metadata.operationInDocumentCollectionDeletedAuditLogSchema.collectionName,
    operationId: e => e.metadata.operationInDocumentCollectionDeletedAuditLogSchema.operationId,
    record: (e, _, { injector }) => resolveRecordAuditLog(e, injector),
  };
