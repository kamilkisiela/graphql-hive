import { gql } from 'graphql-modules';

export const typeDefs = gql`
  """
  AuditLog is a record of actions performed by users in
  the organization. It is used to track changes and
  actions performed by users.
  """
  interface AuditLog {
    id: ID!
    eventTime: DateTime!
    record: AuditLogIdRecord!
  }

  type AuditLogIdRecord {
    userId: ID!
    userEmail: String!
    organizationId: ID!
    """
    User can be null if the user is deleted
    """
    user: User
    """
    Organization can be null if the organization is deleted
    """
    organization: Organization
  }

  type AuditLogConnection {
    nodes: [AuditLog!]!
    total: Int!
  }

  """
  AuditLogFilter is used to filter audit logs by
  date range and user id.
  """
  input AuditLogFilter {
    from: DateTime
    to: DateTime
    userId: ID
  }

  """
  AuditLogPaginationFilter is used to paginate audit logs.
  By default, it returns 25 records with an offset of 0.
  """
  input AuditLogPaginationFilter {
    limit: Int = 25
    offset: Int = 0
  }

  extend type Query {
    auditLogs(
      selector: OrganizationSelectorInput!
      filter: AuditLogFilter
      pagination: AuditLogPaginationFilter
    ): AuditLogConnection!
  }

  """
  Schema Policy Audit Logs
  """
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

  """
  Project Audit Logs
  """
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

  """
  User Role Audit Logs
  """
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

  """
  Support Ticket Audit Logs
  """
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

  """
  Laboratory Collection Audit Logs
  """
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

  """
  Operation In Document Collection Audit Logs
  """
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

  """
  Organization Audit Logs
  """
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
    """
    newOwnerEmail can be null if the mutation fails
    """
    newOwnerEmail: String
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

  """
  Target Audit Logs
  """
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

  """
  User Audit Logs
  """
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

  """
  Subscription Audit Logs
  """
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
