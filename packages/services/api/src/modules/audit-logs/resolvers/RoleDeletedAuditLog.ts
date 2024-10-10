import { resolveRecordAuditLog } from '../helpers';
import type { RoleDeletedAuditLogResolvers } from './../../../__generated__/types.next';

export const RoleDeletedAuditLog: RoleDeletedAuditLogResolvers = {
  __isTypeOf: e => e.event_action === 'ROLE_DELETED',
  eventTime: e => new Date(e.event_time).toISOString(),
  roleId: e => e.metadata.roleDeletedAuditLogSchema.roleId,
  roleName: e => e.metadata.roleDeletedAuditLogSchema.roleName,
  record: (e, _, { injector }) => resolveRecordAuditLog(e, injector),
};
