import type { OrganizationSettingsUpdatedAuditLogResolvers } from './../../../__generated__/types.next';

export const OrganizationSettingsUpdatedAuditLog: OrganizationSettingsUpdatedAuditLogResolvers = {
  __isTypeOf: e => e.eventType === 'ORGANIZATION_SETTINGS_UPDATED',
  eventTime: e => e.eventTime,
  eventType: e => e.eventType,
  id: e => e.id,
  updatedFields: e => {
    if (e.eventType === 'ORGANIZATION_SETTINGS_UPDATED') {
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
