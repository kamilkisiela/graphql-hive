import { resolveRecordAuditLog } from '../helpers';
import type { RoleUpdatedAuditLogResolvers } from './../../../__generated__/types.next';

export const RoleUpdatedAuditLog: RoleUpdatedAuditLogResolvers = {
  __isTypeOf: e => e.event_action === 'ROLE_UPDATED',
  eventTime: e => new Date(e.event_time).toISOString(),
  roleId: e => e.metadata.roleUpdatedAuditLogSchema.roleId,
  roleName: e => e.metadata.roleUpdatedAuditLogSchema.roleName,
  updatedFields: e => e.metadata.roleUpdatedAuditLogSchema.updatedFields,
  record: (e, _, { injector }) => resolveRecordAuditLog(e, injector),
};
