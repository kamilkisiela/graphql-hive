import { resolveRecordAuditLog } from '../helpers';
import type { TargetDeletedAuditLogResolvers } from './../../../__generated__/types.next';

export const TargetDeletedAuditLog: TargetDeletedAuditLogResolvers = {
  __isTypeOf: e => e.event_action === 'TARGET_DELETED',
  eventTime: e => new Date(e.event_time).toISOString(),
  projectId: e => e.metadata.targetDeletedAuditLogSchema.projectId,
  targetName: e => e.metadata.targetDeletedAuditLogSchema.targetName,
  targetId: e => e.metadata.targetDeletedAuditLogSchema.target,
  record: (e, _, { injector }) => resolveRecordAuditLog(e, injector),
};
