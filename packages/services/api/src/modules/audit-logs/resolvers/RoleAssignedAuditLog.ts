import type { RoleAssignedAuditLogResolvers } from './../../../__generated__/types.next';

export const RoleAssignedAuditLog: RoleAssignedAuditLogResolvers = {
  __isTypeOf: e => e.eventType === 'ROLE_ASSIGNED',
  eventTime: e => e.eventTime,
  eventType: e => e.eventType,
  id: e => e.id,
  roleId: e => {
    if (e.eventType === 'ROLE_ASSIGNED') {
      return e.roleId;
    }
    throw new Error('Invalid eventType');
  },
  roleName: e => {
    if (e.eventType === 'ROLE_ASSIGNED') {
      return e.roleName;
    }
    throw new Error('Invalid eventType');
  },
  userEmailAssigned: e => {
    if (e.eventType === 'ROLE_ASSIGNED') {
      return e.userEmailAssigned;
    }
    throw new Error('Invalid eventType');
  },
  userIdAssigned: e => {
    if (e.eventType === 'ROLE_ASSIGNED') {
      return e.userIdAssigned;
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
