import { gql } from 'graphql-modules';

export default gql`
   enum AuditLogEventAction {
    USER_INVITED
    USER_JOINED
    EXPIRED_INVITE_HIT
    PROJECT_CREATED
    TARGET_CREATED
    ROLE_CREATED
    ROLE_ASSIGNED
    USER_REMOVED
    ORGANIZATION_TRANSFERRED
    SCHEMA_CHECKED
    SCHEMA_PUBLISHED
    SCHEMA_DELETED
    PROJECT_SETTINGS_UPDATED
    ORGANIZATION_SETTINGS_UPDATED
    TARGET_SETTINGS_UPDATED
    SCHEMA_POLICY_SETTINGS_UPDATED
  }

  type AuditLog {
    event_time: Date!
    user_id: String
    user_email: String
    organization_id: String!
    project_id: String
    project_name: String
    target_id: String
    target_name: String
    schema_version_id: String
    event_action: AuditLogEventAction!
    event_details: JSON
  }

  type AuditLogEdge {
    cursor: String
    node: AuditLog
  }

  type AuditLogConnection {
    edges: [AuditLogEdge]
    pageInfo: PageInfo
  }

  type PageInfo {
    endCursor: String
    hasNextPage: Boolean
  }

  input AuditLogFilterInput {
    startDate: Date
    endDate: Date
    userId: String
    userEmail: String
    projectId: String
    targetId: String
    eventAction: String
  }

  type AuditLogFilter {
    startDate: Date
    endDate: Date
    userId: String
    userEmail: String
    projectId: String
    targetId: String
    eventAction: String
  }

  type AuditLogFileExport {
    url: String
    filters: AuditLogFilter
    validUntil: Date
    createdAt: Date
  }

  type ExportResultEdge {
    cursor: String
    node: AuditLogFileExport
  }

  type ExportResultConnection {
    edges: [ExportResultEdge]
    pageInfo: PageInfo
  }

  extend type Query {
    auditLogs(filter: AuditLogFilterInput, first: Int, after: String): AuditLogConnection
    auditLogExports(first: Int, after: String ): ExportResultConnection
  }

  extend type Mutation {
    exportAuditLogsToFile(filter: AuditLogFilterInput): AuditLogFileExport
  }
`;
