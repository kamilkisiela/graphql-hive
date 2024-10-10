import { resolveRecordAuditLog } from '../helpers';
import type { SchemaPublishAuditLogResolvers } from './../../../__generated__/types.next';

export const SchemaPublishAuditLog: SchemaPublishAuditLogResolvers = {
  __isTypeOf: e => e.event_action === 'SCHEMA_PUBLISH',
  eventTime: e => new Date(e.event_time).toISOString(),
  projectId: e => e.metadata.schemaPublishAuditLogSchema.projectId,
  targetId: e => e.metadata.schemaPublishAuditLogSchema.target,
  record: (e, _, { injector }) => resolveRecordAuditLog(e, injector),
  schemaVersionId: e => e.metadata.schemaPublishAuditLogSchema.schemaVersionId,
  serviceName: e => e.metadata.schemaPublishAuditLogSchema.serviceName,
};
