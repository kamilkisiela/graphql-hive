import { resolveRecordAuditLog } from '../helpers';
import type { ProjectCreatedAuditLogResolvers } from './../../../__generated__/types.next';

export const ProjectCreatedAuditLog: ProjectCreatedAuditLogResolvers = {
  __isTypeOf: e => e.event_action === 'PROJECT_CREATED',
  eventTime: e => new Date(e.event_time).toISOString(),
  projectId: e => e.metadata.projectCreatedAuditLogSchema.projectId,
  projectName: e => e.metadata.projectCreatedAuditLogSchema.projectName,
  record: (e, _, { injector }) => resolveRecordAuditLog(e, injector),
};
