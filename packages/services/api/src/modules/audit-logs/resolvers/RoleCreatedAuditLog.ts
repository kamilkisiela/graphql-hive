import type { RoleCreatedAuditLogResolvers } from './../../../__generated__/types.next';

export const RoleCreatedAuditLog: RoleCreatedAuditLogResolvers = {
  __isTypeOf: e => e.eventType === 'ROLE_CREATED',
  eventTime: e => e.eventTime,
  eventType: e => e.eventType,
  id: e => e.id,
  roleId: e => {
    if (e.eventType === 'ROLE_CREATED') {
      return e.roleId;
    }
    throw new Error('Invalid eventType');
  },
  roleName: e => {
    if (e.eventType === 'ROLE_CREATED') {
      return e.roleName;
    }
    throw new Error('Invalid eventType');
  },
  organizationId: e => e.organizationId,
  user: async (parent, _args, _ctx) => {
    return {
      userEmail: parent.user.userEmail,
      userId: parent.user.userId,
      user: parent.user.user,
      __typename: 'AuditLogUserRecord',
    };
  },
};
