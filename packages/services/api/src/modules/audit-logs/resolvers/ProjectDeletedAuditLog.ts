import { resolveRecordAuditLog } from '../helpers';
import type { ProjectDeletedAuditLogResolvers } from './../../../__generated__/types.next';

export const ProjectDeletedAuditLog: ProjectDeletedAuditLogResolvers = {
  __isTypeOf: e => e.event_action === 'PROJECT_DELETED',
  eventTime: e => new Date(e.event_time).toISOString(),
  projectId: e => e.metadata.projectDeletedAuditLogSchema.projectId,
  projectName: e => e.metadata.projectDeletedAuditLogSchema.projectName,
  record: (e, _, { injector }) => resolveRecordAuditLog(e, injector),
};
