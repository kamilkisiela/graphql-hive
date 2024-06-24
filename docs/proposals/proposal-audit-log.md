# Audit log backend part

### Purpose of audit log

The audit log is a feature that allows users to track changes made to their organization, projects,
schemas, and other resources.


## Implementation

Proposed implementation is to use a single Clickhouse table to store all events. The table will have
the following columns:


```sql
CREATE TABLE audit_log (
  event_time DateTime DEFAULT now(),
  user_id UUID,
  user_email STRING,
  organization_id UUID,
  project_id UUID,
  project_name STRING,
  target_id UUID,
  target_name STRING,
  schema_version_id UUID,
  event_action STRING NOT NULL,
  event_details JSON,
  INDEX idx_user_id user_id TYPE set(0) GRANULARITY 64,
  INDEX idx_user_email user_email TYPE set(0) GRANULARITY 64,
  INDEX idx_organization_id organization_id TYPE set(0) GRANULARITY 64,
  INDEX idx_project_id project_id TYPE set(0) GRANULARITY 64,
  INDEX idx_target_id target_id TYPE set(0) GRANULARITY 64,
) ENGINE = MergeTree ()
ORDER BY event_time
TTL timestamp + INTERVAL 3 MONTH;
```
Data in clickhouse would be append only. We would never manually delete them, we would rely on TTL removing old rows after X months
Of course we could make the interval configurable if necessary.

Audit log is simple class with one method that inserts a single row into the clickhouse table:

```ts
const { createClient } = require('@clickhouse/client');
const clickhouse = createClient()

type AuditLogEvent = {
  userId?: string | null;
  organizationId?: string | null;
  projectId?: string | null;
  targetId?: string | null;
  schemaVersionId?: string | null;
  eventAction: string;
  details: Record<string, any>;
}

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class AuditLog {
  logAuditEvent (event: AuditLogEvent) {
    const { userId, organizationId, projectId, targetId, schemaVersionId, eventAction, details } = event;
    const query = `
      INSERT INTO audit_log (user_id, organization_id, project_id, project_name, target_id, target_name, schema_version_id, event_action, event_details)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    return clickhouse.query(query, [
      userId,
      organizationId,
      projectId,
      targetId,
      schemaVersionId,
      eventKind,
      eventAction,
      JSON.stringify(details),
    ])
  };
}

// sample usage - always await unless performance is critical
await this.auditLog.logAuditEvent({
  userId: '690ae6ae-30e7-4e6c-8114-97e50e41aee5',
  organizationId: 'da2dbbf8-6c03-4abf-964d-8a2d949da5cb',
  action: 'joinOrganization',
})
```

We would call this `logAuditEvent` function in all the places in the codebase to log the events
listed above.

## Audit log UI

# How user could pull audit logs and filter them?

Download would be triggered by a `Download CSV` button in Hive UI.

We would provide these filters:
- **date range** - to avoid pulling entire history of events
- **by user** - in case somebody wants to see actions made by a user
- **by project** - to scope down the logs to a specific project (by default audit log contains data from all projects of the org)
- **by target** - to scope down it even more
- **by action** - type or group of action types


## Audit log events

| Event Action name              | Human Readable Event sample                                                                           |
|--------------------------------|-------------------------------------------------------------------------------------------------------|
| USER_INVITED                   | User **jane@acme.com** was invited to **Acme**.                                                       |
| USER_JOINED                    | User **john@acme.com** joined **Acme**. Approved by **admin@acme.com**. Referrer: **jane@acme.com**.  |
| EXPIRED_INVITE_HIT             | User **john@acme.com** tried to join **Acme** with an expired/invalid invite. Referrer: jane@acme.com |
| PROJECT_CREATED                | User **john@acme.com** created a project named **Project Alpha**.                                     |
| TARGET_CREATED                 | User **john@acme.com** created a target named **Project Alpha**.                                      |
| ROLE_CREATED                   | Admin **admin@acme.com** created a new role **SAMPLE_ROLE**.                                          |
| ROLE_ASSIGNED                  | Admin **admin@acme.com** assigned a new role to user **john@acme.com**.                               |
| USER_REMOVED                   | Admin **admin@acme.com** removed user **john@acme.com**.                                              |
| ORG_TRANSFERRED                | Admin **admin@acme.com** transferred ownership.                                                       |
| SCHEMA_CHECKED                 | CI made a schema check for **Project Alpha**.                                                         |
| SCHEMA_PUBLISH                 | User **john@acme.com** published a new schema version for **Project Alpha**.                          |
| SCHEMA_DELETED                 | Hive background job deleted old schema.                                                               |
| PROJECT_SETTINGS_UPDATED       | Changes made to project **Acme API** settings by **admin@acme.com**.                                  |
| ORGANIZATION_SETTINGS_UPDATED  | Changes made to organization **Acme** settings by **admin@acme.com**.                                 |
| TARGET_SETTINGS_UPDATED        | Changes made to target **Acme dev API** settings by **admin@acme.com**.                               |
| SCHEMA_POLICY_SETTINGS_UPDATED | Changes made to schema policy settings under an org or a project by **admin@acme.com**.               |


Graphql Schema for these queries would look like this:

```graphql

  scalar Date
  scalar JSON

  enum AuditLogEventAction {
    USER_INVITED
    USER_JOINED
    EXPIRED_INVITE_HIT
    PROJECT_CREATED
    TARGET_CREATED
    ROLE_CREATED
    ROLE_ASSIGNED
    USER_REMOVED
    ORG_TRANSFERRED
    SCHEMA_CHECKED
    SCHEMA_PUBLISH
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
    organization_id: String
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

  input AuditLogFilter {
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

  type Query {
    auditLogs(filter: AuditLogFilter, first: Int, after: String): AuditLogConnection
    auditLogExports(first: Int, after: String ): ExportResultConnection
  }

  type Mutation {
    exportAuditLogsToFile(filter: AuditLogFilter): AuditLogFileExport
  }
```

## Audit log export

Stored file is either a CSV or plain text file with a list of events. The file is stored in S3 and a link to download it is returned to the user. The file is stored for 30 days-TTL would be set on S3 object.
We store metadata about the export in postgres:

```sql
CREATE TABLE audit_log_export (
  id UUID PRIMARY KEY,
  url TEXT,
  filters JSON,
  valid_until TIMESTAMP,
  created_at TIMESTAMP DEFAULT now()
);
```

