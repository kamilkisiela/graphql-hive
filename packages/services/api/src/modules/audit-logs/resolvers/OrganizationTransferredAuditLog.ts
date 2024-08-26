import type { OrganizationTransferredAuditLogResolvers } from './../../../__generated__/types.next';

export const OrganizationTransferredAuditLog: OrganizationTransferredAuditLogResolvers = {
  __isTypeOf: e => e.eventType === 'ORGANIZATION_TRANSFERRED',
  eventTime: e => e.eventTime,
  eventType: e => e.eventType,
  id: e => e.id,
  newOwnerEmail: e => {
    if (e.eventType === 'ORGANIZATION_TRANSFERRED') {
      return e.newOwnerEmail;
    }
    throw new Error('Invalid eventType');
  },
  newOwnerId: e => {
    if (e.eventType === 'ORGANIZATION_TRANSFERRED') {
      return e.newOwnerId;
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
