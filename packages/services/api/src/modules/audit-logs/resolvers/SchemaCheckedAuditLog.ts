import { resolveRecordAuditLog } from '../helpers';
import type { SchemaCheckedAuditLogResolvers } from './../../../__generated__/types.next';

export const SchemaCheckedAuditLog: SchemaCheckedAuditLogResolvers = {
  __isTypeOf: e => e.event_action === 'SCHEMA_CHECKED',
  eventTime: e => new Date(e.event_time).toISOString(),
  projectId: e => e.metadata.schemaCheckedAuditLogSchema.projectId,
  targetId: e => e.metadata.schemaCheckedAuditLogSchema.targetId,
  record: (e, _, { injector }) => resolveRecordAuditLog(e, injector),
  checkId: e => e.metadata.schemaCheckedAuditLogSchema.checkId,
};
