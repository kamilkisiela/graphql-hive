import { resolveRecordAuditLog } from '../helpers';
import type { RoleCreatedAuditLogResolvers } from './../../../__generated__/types.next';

export const RoleCreatedAuditLog: RoleCreatedAuditLogResolvers = {
  __isTypeOf: e => e.event_action === 'ROLE_CREATED',
  eventTime: e => new Date(e.event_time).toISOString(),
  roleId: e => e.metadata.roleCreatedAuditLogSchema.roleId,
  roleName: e => e.metadata.roleCreatedAuditLogSchema.roleName,
  record: (e, _, { injector }) => resolveRecordAuditLog(e, injector),
};
