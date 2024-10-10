import { resolveRecordAuditLog } from '../helpers';
import type { RoleAssignedAuditLogResolvers } from './../../../__generated__/types.next';

export const RoleAssignedAuditLog: RoleAssignedAuditLogResolvers = {
  __isTypeOf: e => e.event_action === 'ROLE_ASSIGNED',
  eventTime: e => new Date(e.event_time).toISOString(),
  roleId: e => e.metadata.roleAssignedAuditLogSchema.roleId,
  roleName: e => e.metadata.roleAssignedAuditLogSchema.roleName,
  userEmailAssigned: e => e.metadata.roleAssignedAuditLogSchema.userEmailAssigned,
  userIdAssigned: e => e.metadata.roleAssignedAuditLogSchema.userIdAssigned,
  record: (e, _, { injector }) => resolveRecordAuditLog(e, injector),
};
