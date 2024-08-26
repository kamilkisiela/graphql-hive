import { resolveRecordAuditLog } from '../helpers';
import type { RoleAssignedAuditLogResolvers } from './../../../__generated__/types.next';

/*
 * Note: This object type is generated because "RoleAssignedAuditLogMapper" is declared. This is to ensure runtime safety.
 *
 * When a mapper is used, it is possible to hit runtime errors in some scenarios:
 * - given a field name, the schema type's field type does not match mapper's field type
 * - or a schema type's field does not exist in the mapper's fields
 *
 * If you want to skip this file generation, remove the mapper or update the pattern in the `resolverGeneration.object` config.
 */
export const RoleAssignedAuditLog: RoleAssignedAuditLogResolvers = {
  __isTypeOf: e => e.event_action === 'ROLE_ASSIGNED',
  eventTime: e => new Date(e.event_time).toISOString(),
  previousMemberRole: e => e.metadata.roleAssignedAuditLogSchema.previousMemberRole,
  roleId: e => e.metadata.roleAssignedAuditLogSchema.roleId,
  updatedMember: e => e.metadata.roleAssignedAuditLogSchema.updatedMember,
  userIdAssigned: e => e.metadata.roleAssignedAuditLogSchema.userIdAssigned,
  record: (e, _, { injector }) => resolveRecordAuditLog(e, injector),
};
