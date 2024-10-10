import { z } from 'zod';

const userInvitedAuditLogSchema = z.object({
  inviteeId: z.string(),
  inviteeEmail: z.string(),
});
const userJoinedAuditLogSchema = z.object({
  inviteeId: z.string(),
  inviteeEmail: z.string(),
});

const userRemovedAuditLogSchema = z.object({
  removedUserId: z.string(),
  removedUserEmail: z.string(),
});

const organizationSettingsUpdatedAuditLogSchema = z.object({
  updatedFields: z.string(),
});

const organizationTransferredAuditLogSchema = z.object({
  newOwnerId: z.string(),
  newOwnerEmail: z.string(),
});

const organizationTransferredRequestAuditLogSchema = z.object({
  newOwnerId: z.string(),
  newOwnerEmail: z.string(),
});

const projectCreatedAuditLogSchema = z.object({
  projectId: z.string(),
  projectName: z.string(),
});

const projectSettingsUpdatedAuditLogSchema = z.object({
  projectId: z.string(),
  updatedFields: z.string(),
});

const projectDeletedAuditLogSchema = z.object({
  projectId: z.string(),
  projectName: z.string(),
});

const targetCreatedAuditLogSchema = z.object({
  projectId: z.string(),
  targetId: z.string(),
  targetName: z.string(),
});

const targetSettingsUpdatedAuditLogSchema = z.object({
  projectId: z.string(),
  targetId: z.string(),
  updatedFields: z.string(),
});

const targetDeletedAuditLogSchema = z.object({
  projectId: z.string(),
  targetId: z.string(),
  targetName: z.string(),
});

const schemaPolicySettingsUpdatedAuditLogSchema = z.object({
  projectId: z.string(),
  updatedFields: z.string(),
});

const schemaCheckedAuditLogSchema = z.object({
  projectId: z.string(),
  targetId: z.string(),
  checkId: z.string().nullable(),
});

const schemaPublishAuditLogSchema = z.object({
  projectId: z.string(),
  targetId: z.string(),
  serviceName: z.string().nullable(),
  schemaVersionId: z.string().nullable(),
});

const schemaDeletedAuditLogSchema = z.object({
  projectId: z.string(),
  targetId: z.string(),
  serviceName: z.string(),
});

const roleCreatedAuditLogSchema = z.object({
  roleId: z.string(),
  roleName: z.string(),
});

const roleAssignedAuditLogSchema = z.object({
  roleId: z.string(),
  roleName: z.string(),
  userIdAssigned: z.string(),
  userEmailAssigned: z.string(),
});

const roleDeletedAuditLogSchema = z.object({
  roleId: z.string(),
  roleName: z.string(),
});

const roleUpdatedAuditLogSchema = z.object({
  roleId: z.string(),
  roleName: z.string(),
  updatedFields: z.string(),
});

export const auditLogSchema = z.discriminatedUnion('eventType', [
  z.object({
    eventType: z.literal('USER_INVITED'),
    userInvitedAuditLogSchema,
  }),
  z.object({
    eventType: z.literal('USER_JOINED'),
    userJoinedAuditLogSchema,
  }),
  z.object({
    eventType: z.literal('USER_REMOVED'),
    userRemovedAuditLogSchema,
  }),
  z.object({
    eventType: z.literal('ORGANIZATION_SETTINGS_UPDATED'),
    organizationSettingsUpdatedAuditLogSchema,
  }),
  z.object({
    eventType: z.literal('ORGANIZATION_TRANSFERRED'),
    organizationTransferredAuditLogSchema,
  }),
  z.object({
    eventType: z.literal('ORGANIZATION_TRANSFERRED_REQUEST'),
    organizationTransferredRequestAuditLogSchema,
  }),
  z.object({
    eventType: z.literal('PROJECT_CREATED'),
    projectCreatedAuditLogSchema,
  }),
  z.object({
    eventType: z.literal('PROJECT_SETTINGS_UPDATED'),
    projectSettingsUpdatedAuditLogSchema,
  }),
  z.object({
    eventType: z.literal('PROJECT_DELETED'),
    projectDeletedAuditLogSchema,
  }),
  z.object({
    eventType: z.literal('TARGET_CREATED'),
    targetCreatedAuditLogSchema,
  }),
  z.object({
    eventType: z.literal('TARGET_SETTINGS_UPDATED'),
    targetSettingsUpdatedAuditLogSchema,
  }),
  z.object({
    eventType: z.literal('TARGET_DELETED'),
    targetDeletedAuditLogSchema,
  }),
  z.object({
    eventType: z.literal('SCHEMA_POLICY_SETTINGS_UPDATED'),
    schemaPolicySettingsUpdatedAuditLogSchema,
  }),
  z.object({
    eventType: z.literal('SCHEMA_CHECKED'),
    schemaCheckedAuditLogSchema,
  }),
  z.object({
    eventType: z.literal('SCHEMA_PUBLISH'),
    schemaPublishAuditLogSchema,
  }),
  z.object({
    eventType: z.literal('SCHEMA_DELETED'),
    schemaDeletedAuditLogSchema,
  }),
  z.object({
    eventType: z.literal('ROLE_CREATED'),
    roleCreatedAuditLogSchema,
  }),
  z.object({
    eventType: z.literal('ROLE_ASSIGNED'),
    roleAssignedAuditLogSchema,
  }),
  z.object({
    eventType: z.literal('ROLE_DELETED'),
    roleDeletedAuditLogSchema,
  }),
  z.object({
    eventType: z.literal('ROLE_UPDATED'),
    roleUpdatedAuditLogSchema,
  }),
]);

export type AuditLogEvent = z.infer<typeof auditLogSchema>
