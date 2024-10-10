import { resolveRecordAuditLog } from '../helpers';
import type { TargetSettingsUpdatedAuditLogResolvers } from './../../../__generated__/types.next';

export const TargetSettingsUpdatedAuditLog: TargetSettingsUpdatedAuditLogResolvers = {
  __isTypeOf: e => e.event_action === 'TARGET_SETTINGS_UPDATED',
  eventTime: e => new Date(e.event_time).toISOString(),
  projectId: e => e.metadata.targetSettingsUpdatedAuditLogSchema.projectId,
  updatedFields: e => e.metadata.targetSettingsUpdatedAuditLogSchema.updatedFields,
  targetId: e => e.metadata.targetSettingsUpdatedAuditLogSchema.target,
  record: (e, _, { injector }) => resolveRecordAuditLog(e, injector),
};
