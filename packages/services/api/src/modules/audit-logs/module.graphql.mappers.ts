import { AuditLogModel } from './providers/audit-logs-manager';

export type AuditLogMapper = AuditLogModel;
// Schema
export type SchemaPolicySettingsUpdatedAuditLogMapper = AuditLogModel;
export type SchemaCheckedAuditLogMapper = AuditLogModel;
export type SchemaPublishAuditLogMapper = AuditLogModel;
export type SchemaDeletedAuditLogMapper = AuditLogModel;
// Organization
export type OrganizationSettingsUpdatedAuditLogMapper = AuditLogModel;
export type OrganizationTransferredAuditLogMapper = AuditLogModel;
export type OrganizationTransferredRequestAuditLogMapper = AuditLogModel;
export type OrganizationCreatedAuditLogMapper = AuditLogModel;
export type OrganizationDeletedAuditLogMapper = AuditLogModel;
export type OrganizationUpdatedIntegrationAuditLogMapper = AuditLogModel;
// Project
export type ProjectCreatedAuditLogMapper = AuditLogModel;
export type ProjectSettingsUpdatedAuditLogMapper = AuditLogModel;
export type ProjectDeletedAuditLogMapper = AuditLogModel;
// User Role
export type RoleCreatedAuditLogMapper = AuditLogModel;
export type RoleAssignedAuditLogMapper = AuditLogModel;
export type RoleDeletedAuditLogMapper = AuditLogModel;
export type RoleUpdatedAuditLogMapper = AuditLogModel;
// Support
export type SupportTicketCreatedAuditLogMapper = AuditLogModel;
export type SupportTicketUpdatedAuditLogMapper = AuditLogModel;
// Laboratory Collection
export type CollectionCreatedAuditLogMapper = AuditLogModel;
export type CollectionDeletedAuditLogMapper = AuditLogModel;
export type CollectionUpdatedAuditLogMapper = AuditLogModel;
// Laboratory Collection Operation
export type OperationInDocumentCollectionCreatedAuditLogMapper = AuditLogModel;
export type OperationInDocumentCollectionUpdatedAuditLogMapper = AuditLogModel;
export type OperationInDocumentCollectionDeletedAuditLogMapper = AuditLogModel;
// User
export type UserInvitedAuditLogMapper = AuditLogModel;
export type UserJoinedAuditLogMapper = AuditLogModel;
export type UserRemovedAuditLogMapper = AuditLogModel;
export type UserSettingsUpdatedAuditLogMapper = AuditLogModel;
// Target
export type TargetCreatedAuditLogMapper = AuditLogModel;
export type TargetSettingsUpdatedAuditLogMapper = AuditLogModel;
export type TargetDeletedAuditLogMapper = AuditLogModel;
// Subscription
export type SubscriptionCreatedAuditLogMapper = AuditLogModel;
export type SubscriptionUpdatedAuditLogMapper = AuditLogModel;
export type SubscriptionCanceledAuditLogMapper = AuditLogModel;
