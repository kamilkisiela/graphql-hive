import type { TargetDeletedAuditLogResolvers } from './../../../__generated__/types.next';

export const TargetDeletedAuditLog: TargetDeletedAuditLogResolvers = {
  __isTypeOf: e => e.eventType === 'TARGET_DELETED',
  eventTime: e => e.eventTime,
  eventType: e => e.eventType,
  id: e => e.id,
  projectId: e => {
    if (e.eventType === 'TARGET_DELETED') {
      return e.projectId;
    }
    throw new Error('Invalid eventType');
  },
  targetId: e => {
    if (e.eventType === 'TARGET_DELETED') {
      return e.targetId;
    }
    throw new Error('Invalid eventType');
  },
  targetName: e => {
    if (e.eventType === 'TARGET_DELETED') {
      return e.targetName;
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
