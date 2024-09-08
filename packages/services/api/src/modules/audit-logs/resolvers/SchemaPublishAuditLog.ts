import type { SchemaPublishAuditLogResolvers } from './../../../__generated__/types.next';

export const SchemaPublishAuditLog: SchemaPublishAuditLogResolvers = {
  __isTypeOf: e => e.eventType === 'SCHEMA_PUBLISH',
  eventTime: e => e.eventTime,
  eventType: e => e.eventType,
  id: e => e.id,
  projectId: e => {
    if (e.eventType === 'SCHEMA_PUBLISH') {
      return e.projectId;
    }
    throw new Error('Invalid eventType');
  },
  targetId: e => {
    if (e.eventType === 'SCHEMA_PUBLISH') {
      return e.targetId;
    }
    throw new Error('Invalid eventType');
  },
  schemaName: e => {
    if (e.eventType === 'SCHEMA_PUBLISH') {
      return e.schemaName;
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
