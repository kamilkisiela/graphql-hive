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
    auditLogs(selector: OrganizationSelectorInput!, filter: AuditLogFilter, pagination: AuditLogPaginationInput): AuditLogConnection!
  }

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
    newOwnerEmail: String!
  }

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
  }

  type ServiceDeletedAuditLog implements AuditLog {
    id: ID!  
    eventTime: DateTime!  
    record: AuditLogIdRecord!  
    projectId: String!
    targetId: String!
    serviceName: String!
  }

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
    roleName: String!
    userIdAssigned: String!
    userEmailAssigned: String!
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
`;
