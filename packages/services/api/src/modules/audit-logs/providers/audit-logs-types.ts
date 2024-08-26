import { z } from 'zod';

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
  serviceName: z.string().nullish(),
  schemaVersionId: z.string().nullish(),
  isSchemaPublishMissingUrlErrorSelected: z.boolean(),
});

const schemaDeletedAuditLogSchema = z.object({
  projectId: z.string(),
  targetId: z.string(),
  serviceName: z.string(),
});

// Role
const roleCreatedAuditLogSchema = z.object({
  roleId: z.string(),
  roleName: z.string(),
});

const roleAssignedAuditLogSchema = z.object({
  roleId: z.string(),
  updatedMember: z.string(),
  previousMemberRole: z.string().nullable(),
  userIdAssigned: z.string(),
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

// Support
const supportTicketCreatedAuditLogSchema = z.object({
  ticketId: z.string(),
  ticketSubject: z.string(),
  ticketDescription: z.string(),
  ticketPriority: z.string(),
});

const supportTicketUpdatedAuditLogSchema = z.object({
  ticketId: z.string(),
  updatedFields: z.string(),
});

// Laboratory Collection
const collectionCreatedAuditLogSchema = z.object({
  collectionId: z.string(),
  collectionName: z.string(),
  targetId: z.string(),
});

const collectionUpdatedAuditLogSchema = z.object({
  collectionId: z.string(),
  collectionName: z.string(),
  updatedFields: z.string(),
});

const collectionDeletedAuditLogSchema = z.object({
  collectionId: z.string(),
  collectionName: z.string(),
});

// Laboratory Collection Operations
const operationInDocumentCollectionCreatedAuditLogSchema = z.object({
  collectionId: z.string(),
  collectionName: z.string(),
  targetId: z.string(),
  operationId: z.string(),
  operationQuery: z.string(),
});

const operationInDocumentCollectionUpdatedAuditLogSchema = z.object({
  collectionId: z.string(),
  collectionName: z.string(),
  operationId: z.string(),
  updatedFields: z.string(),
});

const operationInDocumentCollectionDeletedAuditLogSchema = z.object({
  collectionId: z.string(),
  collectionName: z.string(),
  operationId: z.string(),
});

// Organization
const organizationSettingsUpdatedAuditLogSchema = z.object({
  updatedFields: z.string(),
});

const organizationTransferredAuditLogSchema = z.object({
  newOwnerId: z.string(),
  newOwnerEmail: z.string(),
});

const organizationTransferredRequestAuditLogSchema = z.object({
  newOwnerId: z.string(),
  newOwnerEmail: z.string().nullable(),
});

const organizationCreatedAuditLogSchema = z.object({
  organizationName: z.string(),
  organizationId: z.string(),
});

const organizationDeletedAuditLogSchema = z.object({
  organizationId: z.string(),
});

const organizationUpdatedIntegrationAuditLogSchema = z.object({
  integrationId: z.string().nullable(),
  updatedFields: z.string(),
});

// Target
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

// User
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

const userSettingsUpdatedAuditLogSchema = z.object({
  updatedFields: z.string(),
});

// Subscriptions
const subscriptionCreatedAuditLogSchema = z.object({
  paymentMethodId: z.string().nullish(),
  operations: z.number(),
  previousPlan: z.string(),
  newPlan: z.string(),
});

const subscriptionUpdatedAuditLogSchema = z.object({
  updatedFields: z.string(),
});

const subscriptionCanceledAuditLogSchema = z.object({
  previousPlan: z.string(),
  newPlan: z.string(),
});

// Project
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
    eventType: z.literal('USER_SETTINGS_UPDATED'),
    userSettingsUpdatedAuditLogSchema,
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
  z.object({
    eventType: z.literal('SUPPORT_TICKET_CREATED'),
    supportTicketCreatedAuditLogSchema,
  }),
  z.object({
    eventType: z.literal('SUPPORT_TICKET_UPDATED'),
    supportTicketUpdatedAuditLogSchema,
  }),
  z.object({
    eventType: z.literal('COLLECTION_CREATED'),
    collectionCreatedAuditLogSchema,
  }),
  z.object({
    eventType: z.literal('COLLECTION_UPDATED'),
    collectionUpdatedAuditLogSchema,
  }),
  z.object({
    eventType: z.literal('COLLECTION_DELETED'),
    collectionDeletedAuditLogSchema,
  }),
  z.object({
    eventType: z.literal('OPERATION_IN_DOCUMENT_COLLECTION_CREATED'),
    operationInDocumentCollectionCreatedAuditLogSchema,
  }),
  z.object({
    eventType: z.literal('OPERATION_IN_DOCUMENT_COLLECTION_UPDATED'),
    operationInDocumentCollectionUpdatedAuditLogSchema,
  }),
  z.object({
    eventType: z.literal('OPERATION_IN_DOCUMENT_COLLECTION_DELETED'),
    operationInDocumentCollectionDeletedAuditLogSchema,
  }),
  z.object({
    eventType: z.literal('ORGANIZATION_CREATED'),
    organizationCreatedAuditLogSchema,
  }),
  z.object({
    eventType: z.literal('ORGANIZATION_DELETED'),
    organizationDeletedAuditLogSchema,
  }),
  z.object({
    eventType: z.literal('ORGANIZATION_UPDATED_INTEGRATION'),
    organizationUpdatedIntegrationAuditLogSchema,
  }),
  z.object({
    eventType: z.literal('SUBSCRIPTION_CREATED'),
    subscriptionCreatedAuditLogSchema,
  }),
  z.object({
    eventType: z.literal('SUBSCRIPTION_UPDATED'),
    subscriptionUpdatedAuditLogSchema,
  }),
  z.object({
    eventType: z.literal('SUBSCRIPTION_CANCELED'),
    subscriptionCanceledAuditLogSchema,
  }),
]);

export type AuditLogEvent = z.infer<typeof auditLogSchema>;
