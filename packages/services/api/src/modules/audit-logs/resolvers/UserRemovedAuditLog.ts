import type { UserRemovedAuditLogResolvers } from './../../../__generated__/types.next';

export const UserRemovedAuditLog: UserRemovedAuditLogResolvers = {
  __isTypeOf: e => e.eventType === 'USER_REMOVED',
  eventTime: e => e.eventTime,
  eventType: e => e.eventType,
  id: e => e.id,
  removedUserEmail: e => {
    if (e.eventType === 'USER_REMOVED') {
      return e.removedUserEmail;
    }
    throw new Error('Invalid eventType');
  },
  removedUserId: e => {
    if (e.eventType === 'USER_REMOVED') {
      return e.removedUserEmail;
    }
    throw new Error('Invalid eventType');
  },
  organizationId: e => e.organizationId,
  user: e => {
    return {
      userEmail: e.user.userEmail,
      userId: e.user.userId,
      user: e.user.user,
    };
  },
};
