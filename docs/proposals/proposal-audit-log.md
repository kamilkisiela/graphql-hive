# Audit log

### Purpose of audit log

The audit log is a feature that allows users to track changes made to their organization, projects,
schemas, and other resources.

## Events to track

### OrganizationManager

- `leaveOrganization`
- `createOrganization`
- `deleteOrganization`
- `updatePlan`
- `updateRateLimits`
- `updateName`
- `deleteInvitation`
- `inviteByEmail`
- `joinOrganization`
- `requestOwnershipTransfer`
- `answerOwnershipTransferRequest`
- `deleteMember`
- `updateMemberAccess`
- `createMemberRole`
- `deleteMemberRole`
- `assignMemberRole`
- `updateMemberRole`
- `createRoleWithMembersMigration`
- `assignRoleToMembersMigration`

  ### ProjectManager

- `createProject`
- `deleteProject`
- `updateName`

### TargetManager

- `createTarget`
- `deleteTarget`
- `setTargetValidation`
- `updateTargetValidationSettings`
- `updateName`
- `updateTargetGraphQLEndpointUrl`
- `updateTargetSchemaComposition`

### SchemaPublisher

- `delete`

### SchemaManager

- `updateSchemaVersionStatus`
- `createVersion`
- `updateBaseSchema`
- `disableExternalSchemaComposition`
- `enableExternalSchemaComposition`
- `updateNativeSchemaComposition`
- `updateRegistryModel`
- `approveFailedSchemaCheck`

### BillingProvider

- `upgradeToPro`
- `syncOrganization`
- `downgradeToHobby`

### CdnProvider

- `createCDNAccessToken`
- `deleteCDNAccessToken`

### CollectionProvider

- `createCollection`
- `deleteCollection`
- `createOperation`
- `updateOperation`
- `updateCollection`
- `deleteOperation`

### GitHubIntegrationManager

- `register`
- `unregister`
- `enableProjectNameInGithubCheck`

### SlackIntegrationManager

- `register`
- `unregister`

### OIDCIntegrationsProvider

- `createOIDCIntegrationForOrganization`
- `updateOIDCIntegration`
- `deleteOIDCIntegration`

### Contracts

- `createContract`
- `disableContract`

### AlertsManager

- `addChannel`
- `deleteChannels`
- `addAlert`
- `deleteAlerts`

## Storage

- updateUser
- updateOrganizationName
- updateOrganizationPlan
- updateOrganizationRateLimits
- createOrganizationInvitation
- deleteOrganizationInvitationByEmail
- createOrganizationTransferRequest
- answerOrganizationTransferRequest
- addOrganizationMemberViaInvitationCode
- deleteOrganizationMember
- updateOrganizationMemberAccess
- assignOrganizationMemberRole
- assignOrganizationMemberRoleToMany
- deleteOrganizationMemberRole
- updateProjectRegistryModel
- createVersion
- updateVersionStatus
- createActivity
- addSlackIntegration
- deleteSlackIntegration
- addGitHubIntegration
- deleteGitHubIntegration
- setSchemaPolicyForOrganization
- setSchemaPolicyForProject
- createDocumentCollection
- deleteDocumentCollection
- updateDocumentCollection
- createDocumentCollectionDocument
- deleteDocumentCollectionDocument
- updateDocumentCollectionDocument
- createSchemaCheck


## Implementation

Proposed implementation is to use a single Clickhouse table to store all events. The table will have
the following columns:


```sql
CREATE TABLE audit_log (
  event_time DateTime DEFAULT now(),
  user_id UUID,
  organization_id UUID,
  project_id UUID,
  project_name STRING,
  target_id UUID,
  target_name STRING,
  schema_version_id UUID,
  event_kind STRING,
  event_action STRING,
  event_details JSON
) ENGINE = MergeTree ()
ORDER BY event_time
TTL timestamp + INTERVAL 3 MONTH;
```
Data in clickhouse would be append only. We would never manually delete them, we would rely on TTL removing old rows after X months
Of course we could make the interval configurable if necessary.

Our log function will be a simple function that inserts a row into the table:

```ts
import { ClickHouse } from 'clickhouse';

const clickhouse = new ClickHouse(/* ... */)

type AuditLogEvent = {
  userId?: string | null;
  organizationId?: string | null;
  projectId?: string | null;
  targetId?: string | null;
  schemaVersionId?: string | null;
  eventKind: string;
  eventAction: string;
  details: Record<string, any>;
}

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class AuditLog {
  logAuditEvent (event: AuditLogEvent) {
    const { userId, organizationId, projectId, targetId, schemaVersionId, eventAction, details, eventKind } = event;
    const query = `
      INSERT INTO audit_log (user_id, organization_id, project_id, project_name, target_id, target_name, schema_version_id, event_kind, event_action, event_details)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    clickhouse.query(query, [
      userId,
      organizationId,
      projectId,
      projectId,
      targetId,
      schemaVersionId,
      eventKind,
      eventAction,
      JSON.stringify(details),
    ]).catch((err) => {
      console.error('Failed to log audit event', err);
    })
  };
}

// sample usage - do not await to avoid blocking the the thread


this.auditLog.logAuditEvent({
  userId: '690ae6ae-30e7-4e6c-8114-97e50e41aee5',
  organizationId: 'da2dbbf8-6c03-4abf-964d-8a2d949da5cb',
  eventKind: 'OrganizationManager',
  action: 'joinOrganization',
})
```

We would call this `logAuditEvent` function in all the places in the codebase to log the events
listed above.
