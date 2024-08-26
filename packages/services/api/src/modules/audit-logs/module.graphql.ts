import { gql } from 'graphql-modules';

export const typeDefs = gql`
  interface AuditLog {
    id: ID!
    eventTime: DateTime!
    record: AuditLogIdRecord!
  }

  type AuditLogIdRecord {
    userId: ID!
    userEmail: String!
    organizationId: ID!
    user: User # This one is nullable because it can be deleted!
    organization: Organization # This one is nullable because it can be deleted!
  }

  type AuditLogConnection {
    nodes: [AuditLog!]!
    total: Int!
  }

  #  todo: Handle the rest of the AuditLog types
  input AuditLogFilter {
    startDate: DateTime
    endDate: DateTime
    userId: ID
  }

  input AuditLogPaginationInput {
    limit: Int! = 25
    offset: Int! = 0
  }

  extend type Query {
    auditLogs(
      selector: OrganizationSelectorInput!
      filter: AuditLogFilter
      pagination: AuditLogPaginationInput
    ): AuditLogConnection!
  }

  type SchemaPolicySettingsUpdatedAuditLog implements AuditLog {
    id: ID!
    eventTime: DateTime!
    record: AuditLogIdRecord!
    projectId: String!
    updatedFields: JSON!
  }

  type SchemaCheckedAuditLog implements AuditLog {
    id: ID!
    eventTime: DateTime!
    record: AuditLogIdRecord!
    projectId: String!
    targetId: String!
    checkId: String!
  }

  type SchemaPublishAuditLog implements AuditLog {
    id: ID!
    eventTime: DateTime!
    record: AuditLogIdRecord!
    projectId: String!
    targetId: String!
    serviceName: String
    schemaVersionId: String
    isSchemaPublishMissingUrlErrorSelected: Boolean!
  }

  type ServiceDeletedAuditLog implements AuditLog {
    id: ID!
    eventTime: DateTime!
    record: AuditLogIdRecord!
    projectId: String!
    targetId: String!
    serviceName: String!
  }

  # Project Audit Logs
  type ProjectCreatedAuditLog implements AuditLog {
    id: ID!
    eventTime: DateTime!
    record: AuditLogIdRecord!
    projectId: String!
    projectName: String!
  }

  type ProjectSettingsUpdatedAuditLog implements AuditLog {
    id: ID!
    eventTime: DateTime!
    record: AuditLogIdRecord!
    projectId: String!
    updatedFields: JSON!
  }

  type ProjectDeletedAuditLog implements AuditLog {
    id: ID!
    eventTime: DateTime!
    record: AuditLogIdRecord!
    projectId: String!
    projectName: String!
  }

  # User Role Audit Logs
  type RoleCreatedAuditLog implements AuditLog {
    id: ID!
    eventTime: DateTime!
    record: AuditLogIdRecord!
    roleId: String!
    roleName: String!
  }

  type RoleAssignedAuditLog implements AuditLog {
    id: ID!
    eventTime: DateTime!
    record: AuditLogIdRecord!
    roleId: String!
    updatedMember: String!
    previousMemberRole: String # This one is nullable because can be without a previous role
    userIdAssigned: String!
  }

  type RoleDeletedAuditLog implements AuditLog {
    id: ID!
    eventTime: DateTime!
    record: AuditLogIdRecord!
    roleId: String!
    roleName: String!
  }

  type RoleUpdatedAuditLog implements AuditLog {
    id: ID!
    eventTime: DateTime!
    record: AuditLogIdRecord!
    roleId: String!
    roleName: String!
    updatedFields: JSON!
  }

  # Support Ticket Audit Logs
  type SupportTicketCreatedAuditLog implements AuditLog {
    id: ID!
    eventTime: DateTime!
    record: AuditLogIdRecord!
    ticketId: String!
    ticketSubject: String!
    ticketDescription: String!
    ticketPriority: String!
  }

  type SupportTicketUpdatedAuditLog implements AuditLog {
    id: ID!
    eventTime: DateTime!
    record: AuditLogIdRecord!
    ticketId: String!
    updatedFields: JSON!
  }

  # Laboratory Collection Audit Logs
  type CollectionCreatedAuditLog implements AuditLog {
    id: ID!
    eventTime: DateTime!
    record: AuditLogIdRecord!
    collectionId: String!
    collectionName: String!
    targetId: String!
  }

  type CollectionUpdatedAuditLog implements AuditLog {
    id: ID!
    eventTime: DateTime!
    record: AuditLogIdRecord!
    collectionId: String!
    collectionName: String!
    updatedFields: JSON!
  }

  type CollectionDeletedAuditLog implements AuditLog {
    id: ID!
    eventTime: DateTime!
    record: AuditLogIdRecord!
    collectionId: String!
    collectionName: String!
  }
  # Operation In Document Collection Audit Logs
  type OperationInDocumentCollectionCreatedAuditLog implements AuditLog {
    id: ID!
    eventTime: DateTime!
    record: AuditLogIdRecord!
    collectionId: String!
    collectionName: String!
    targetId: String!
    operationId: String!
    operationQuery: String!
  }

  type OperationInDocumentCollectionUpdatedAuditLog implements AuditLog {
    id: ID!
    eventTime: DateTime!
    record: AuditLogIdRecord!
    collectionId: String!
    collectionName: String!
    operationId: String!
    updatedFields: JSON!
  }

  type OperationInDocumentCollectionDeletedAuditLog implements AuditLog {
    id: ID!
    eventTime: DateTime!
    record: AuditLogIdRecord!
    collectionId: String!
    collectionName: String!
    operationId: String!
  }

  # Organization Audit Logs
  type OrganizationSettingsUpdatedAuditLog implements AuditLog {
    id: ID!
    eventTime: DateTime!
    record: AuditLogIdRecord!
    updatedFields: JSON!
  }

  type OrganizationTransferredAuditLog implements AuditLog {
    id: ID!
    eventTime: DateTime!
    record: AuditLogIdRecord!
    newOwnerId: String!
    newOwnerEmail: String!
  }

  type OrganizationTransferredRequestAuditLog implements AuditLog {
    id: ID!
    eventTime: DateTime!
    record: AuditLogIdRecord!
    newOwnerId: String!
    newOwnerEmail: String # This one is nullable because the mutation can fail
  }

  type OrganizationCreatedAuditLog implements AuditLog {
    id: ID!
    eventTime: DateTime!
    record: AuditLogIdRecord!
    organizationName: String!
    organizationId: String
  }

  type OrganizationDeletedAuditLog implements AuditLog {
    id: ID!
    eventTime: DateTime!
    record: AuditLogIdRecord!
    organizationId: String
  }

  type OrganizationUpdatedIntegrationAuditLog implements AuditLog {
    id: ID!
    eventTime: DateTime!
    record: AuditLogIdRecord!
    integrationId: String
    updatedFields: JSON!
  }

  # Target
  type TargetCreatedAuditLog implements AuditLog {
    id: ID!
    eventTime: DateTime!
    record: AuditLogIdRecord!
    projectId: String!
    targetId: String!
    targetName: String!
  }

  type TargetSettingsUpdatedAuditLog implements AuditLog {
    id: ID!
    eventTime: DateTime!
    record: AuditLogIdRecord!
    projectId: String!
    targetId: String!
    updatedFields: JSON!
  }

  type TargetDeletedAuditLog implements AuditLog {
    id: ID!
    eventTime: DateTime!
    record: AuditLogIdRecord!
    projectId: String!
    targetId: String!
    targetName: String!
  }

  # User
  type UserInvitedAuditLog implements AuditLog {
    id: ID!
    eventTime: DateTime!
    record: AuditLogIdRecord!
    inviteeId: String!
    inviteeEmail: String!
  }

  type UserJoinedAuditLog implements AuditLog {
    id: ID!
    eventTime: DateTime!
    record: AuditLogIdRecord!
    inviteeId: String!
    inviteeEmail: String!
  }

  type UserRemovedAuditLog implements AuditLog {
    id: ID!
    eventTime: DateTime!
    record: AuditLogIdRecord!
    removedUserId: String!
    removedUserEmail: String!
  }

  type UserSettingsUpdatedAuditLog implements AuditLog {
    id: ID!
    eventTime: DateTime!
    record: AuditLogIdRecord!
    updatedFields: JSON!
  }

  # Subscription
  type SubscriptionCreatedAuditLog implements AuditLog {
    id: ID!
    eventTime: DateTime!
    record: AuditLogIdRecord!
    paymentMethodId: String
    operations: Int!
    previousPlan: String!
    newPlan: String!
  }

  type SubscriptionUpdatedAuditLog implements AuditLog {
    id: ID!
    eventTime: DateTime!
    record: AuditLogIdRecord!
    updatedFields: JSON!
  }

  type SubscriptionCanceledAuditLog implements AuditLog {
    id: ID!
    eventTime: DateTime!
    record: AuditLogIdRecord!
    previousPlan: String!
    newPlan: String!
  }
`;
