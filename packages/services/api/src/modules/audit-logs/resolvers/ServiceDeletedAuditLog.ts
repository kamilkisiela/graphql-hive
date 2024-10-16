import { resolveRecordAuditLog } from '../helpers';
import type { ServiceDeletedAuditLogResolvers } from './../../../__generated__/types.next';

/*
 * Note: This object type is generated because "ServiceDeletedAuditLogMapper" is declared. This is to ensure runtime safety.
 *
 * When a mapper is used, it is possible to hit runtime errors in some scenarios:
 * - given a field name, the schema type's field type does not match mapper's field type
 * - or a schema type's field does not exist in the mapper's fields
 *
 * If you want to skip this file generation, remove the mapper or update the pattern in the `resolverGeneration.object` config.
 */
export const ServiceDeletedAuditLog: ServiceDeletedAuditLogResolvers = {
  __isTypeOf: e => e.event_action === 'SERVICE_DELETED',
  eventTime: e => new Date(e.event_time).toISOString(),
  projectId: e => e.metadata.serviceDeletedAuditLogSchema.projectId,
  serviceName: e => e.metadata.serviceDeletedAuditLogSchema.serviceName,
  targetId: e => e.metadata.serviceDeletedAuditLogSchema.targetId,
  record: (e, _, { injector }) => resolveRecordAuditLog(e, injector),
};
