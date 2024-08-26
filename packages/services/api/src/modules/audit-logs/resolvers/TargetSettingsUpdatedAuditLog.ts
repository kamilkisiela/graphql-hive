import type { TargetSettingsUpdatedAuditLogResolvers } from './../../../__generated__/types.next';

export const TargetSettingsUpdatedAuditLog: TargetSettingsUpdatedAuditLogResolvers = {
  __isTypeOf: e => e.eventType === 'TARGET_SETTINGS_UPDATED',
  eventTime: e => e.eventTime,
  eventType: e => e.eventType,
  id: e => e.id,
  projectId: e => {
    if (e.eventType === 'TARGET_SETTINGS_UPDATED') {
      return e.projectId;
    }
    throw new Error('Invalid eventType');
  },
  targetId: e => {
    if (e.eventType === 'TARGET_SETTINGS_UPDATED') {
      return e.targetId;
    }
    throw new Error('Invalid eventType');
  },
  updatedFields: e => {
    if (e.eventType === 'TARGET_SETTINGS_UPDATED') {
      return e.updatedFields;
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
