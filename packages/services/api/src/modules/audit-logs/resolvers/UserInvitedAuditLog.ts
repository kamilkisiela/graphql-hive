import type { UserInvitedAuditLogResolvers } from './../../../__generated__/types.next';

export const UserInvitedAuditLog: UserInvitedAuditLogResolvers = {
  __isTypeOf: e => e.eventType === 'USER_INVITED',
  eventTime: e => e.eventTime,
  eventType: e => e.eventType,
  id: e => e.id,
  inviteeEmail: e => {
    if (e.eventType === 'USER_INVITED') {
      return e.inviteeEmail;
    }
    throw new Error('Invalid eventType');
  },
  inviteeId: e => {
    if (e.eventType === 'USER_INVITED') {
      return e.inviteeId;
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
