import { resolveRecordAuditLog } from '../helpers';
import type { TargetCreatedAuditLogResolvers } from './../../../__generated__/types.next';

export const TargetCreatedAuditLog: TargetCreatedAuditLogResolvers = {
  __isTypeOf: e => e.event_action === 'TARGET_CREATED',
  eventTime: e => new Date(e.event_time).toISOString(),
  projectId: e => e.metadata.targetCreatedAuditLogSchema.projectId,
  targetName: e => e.metadata.targetCreatedAuditLogSchema.targetName,
  targetId: e => e.metadata.targetCreatedAuditLogSchema.target,
  record: (e, _, { injector }) => resolveRecordAuditLog(e, injector),
};
