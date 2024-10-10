import { resolveRecordAuditLog } from '../helpers';
import type { ProjectSettingsUpdatedAuditLogResolvers } from './../../../__generated__/types.next';

export const ProjectSettingsUpdatedAuditLog: ProjectSettingsUpdatedAuditLogResolvers = {
  __isTypeOf: e => e.event_action === 'PROJECT_SETTINGS_UPDATED',
  eventTime: e => new Date(e.event_time).toISOString(),
  projectId: e => e.metadata.projectSettingsUpdatedAuditLogSchema.projectId,
  updatedFields: e => e.metadata.projectSettingsUpdatedAuditLogSchema.updatedFields,
  record: (e, _, { injector }) => resolveRecordAuditLog(e, injector),
};
