import { z } from 'zod';
import { User } from '../../../__generated__/types';

const UserInvitedAuditLogSchema = z.object({
  inviteeId: z.string(),
  inviteeEmail: z.string(),
});
const UserJoinedAuditLogSchema = z.object({
  inviteeId: z.string(),
  inviteeEmail: z.string(),
});

const UserRemovedAuditLogSchema = z.object({
  removedUserId: z.string(),
  removedUserEmail: z.string(),
});

const OrganizationSettingsUpdatedAuditLogSchema = z.object({
  updatedFields: z.string(),
});

const OrganizationTransferredAuditLogSchema = z.object({
  newOwnerId: z.string(),
  newOwnerEmail: z.string(),
});

const ProjectCreatedAuditLogSchema = z.object({
  projectId: z.string(),
  projectName: z.string(),
});

const ProjectSettingsUpdatedAuditLogSchema = z.object({
  projectId: z.string(),
  updatedFields: z.string(),
});

const ProjectDeletedAuditLogSchema = z.object({
  projectId: z.string(),
  projectName: z.string(),
});

const TargetCreatedAuditLogSchema = z.object({
  projectId: z.string(),
  targetId: z.string(),
  targetName: z.string(),
});

const TargetSettingsUpdatedAuditLogSchema = z.object({
  projectId: z.string(),
  targetId: z.string(),
  updatedFields: z.string(),
});

const TargetDeletedAuditLogSchema = z.object({
  projectId: z.string(),
  targetId: z.string(),
  targetName: z.string(),
});

const SchemaPolicySettingsUpdatedAuditLogSchema = z.object({
  projectId: z.string(),
  updatedFields: z.string(),
});

const SchemaCheckedAuditLogSchema = z.object({
  projectId: z.string(),
  targetId: z.string(),
  schemaSdl: z.string(),
});

const SchemaPublishAuditLogSchema = z.object({
  projectId: z.string(),
  targetId: z.string(),
  schemaName: z.string().nullable().optional(),
  schemaSdl: z.string(),
});

const SchemaDeletedAuditLogSchema = z.object({
  projectId: z.string(),
  targetId: z.string(),
  schemaName: z.string(),
});

const RoleCreatedAuditLogSchema = z.object({
  roleId: z.string(),
  roleName: z.string(),
});

const RoleAssignedAuditLogSchema = z.object({
  roleId: z.string(),
  roleName: z.string(),
  userIdAssigned: z.string(),
  userEmailAssigned: z.string(),
});

const RoleDeletedAuditLogSchema = z.object({
  roleId: z.string(),
  roleName: z.string(),
});

const RoleUpdatedAuditLogSchema = z.object({
  roleId: z.string(),
  roleName: z.string(),
  updatedFields: z.string(),
});

export const auditLogSchema = z.discriminatedUnion('eventType', [
  z.object({
    eventType: z.literal('USER_INVITED'),
    UserInvitedAuditLogSchema,
  }),
  z.object({
    eventType: z.literal('USER_JOINED'),
    UserJoinedAuditLogSchema,
  }),
  z.object({
    eventType: z.literal('USER_REMOVED'),
    UserRemovedAuditLogSchema,
  }),
  z.object({
    eventType: z.literal('ORGANIZATION_SETTINGS_UPDATED'),
    OrganizationSettingsUpdatedAuditLogSchema,
  }),
  z.object({
    eventType: z.literal('ORGANIZATION_TRANSFERRED'),
    OrganizationTransferredAuditLogSchema,
  }),
  z.object({
    eventType: z.literal('PROJECT_CREATED'),
    ProjectCreatedAuditLogSchema,
  }),
  z.object({
    eventType: z.literal('PROJECT_SETTINGS_UPDATED'),
    ProjectSettingsUpdatedAuditLogSchema,
  }),
  z.object({
    eventType: z.literal('PROJECT_DELETED'),
    ProjectDeletedAuditLogSchema,
  }),
  z.object({
    eventType: z.literal('TARGET_CREATED'),
    TargetCreatedAuditLogSchema,
  }),
  z.object({
    eventType: z.literal('TARGET_SETTINGS_UPDATED'),
    TargetSettingsUpdatedAuditLogSchema,
  }),
  z.object({
    eventType: z.literal('TARGET_DELETED'),
    TargetDeletedAuditLogSchema,
  }),
  z.object({
    eventType: z.literal('SCHEMA_POLICY_SETTINGS_UPDATED'),
    SchemaPolicySettingsUpdatedAuditLogSchema,
  }),
  z.object({
    eventType: z.literal('SCHEMA_CHECKED'),
    SchemaCheckedAuditLogSchema,
  }),
  z.object({
    eventType: z.literal('SCHEMA_PUBLISH'),
    SchemaPublishAuditLogSchema,
  }),
  z.object({
    eventType: z.literal('SCHEMA_DELETED'),
    SchemaDeletedAuditLogSchema,
  }),
  z.object({
    eventType: z.literal('ROLE_CREATED'),
    RoleCreatedAuditLogSchema,
  }),
  z.object({
    eventType: z.literal('ROLE_ASSIGNED'),
    RoleAssignedAuditLogSchema,
  }),
  z.object({
    eventType: z.literal('ROLE_DELETED'),
    RoleDeletedAuditLogSchema,
  }),
  z.object({
    eventType: z.literal('ROLE_UPDATED'),
    RoleUpdatedAuditLogSchema,
  }),
]);

export type AuditLogEvent = z.infer<typeof auditLogSchema> & {
  id?: string;
  eventTime: string;
  user: {
    userId: string;
    userEmail: string;
    user?: User | null;
  };
  organizationId: string;
};
