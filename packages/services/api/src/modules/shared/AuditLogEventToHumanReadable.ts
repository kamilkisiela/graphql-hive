import { AuditLogEventAction } from '../../__generated__/types';
import { AuditLogEvent } from './providers/AuditLog';

export type EventDetailsUnion =
  | {
      user: {
        id: string;
        email: string;
      };
    }
  | {
      role: string;
    }
  | {
      newOwner: {
        id: string;
        email: string;
      };
    };

export type AuditLogEventWithMethods = {
  getOrganizationName: () => string;
  getProjectName: () => string;
  details: EventDetailsUnion;
} & AuditLogEvent;

const eventRenderers: Record<AuditLogEventAction, (event: AuditLogEventWithMethods) => string> = {
  USER_INVITED: event => `User ${event.user?.email} was invited to ${event.getOrganizationName()}.`,
  USER_JOINED: event => `User ${event.user?.email} joined ${event.getOrganizationName()}.`,
  EXPIRED_INVITE_HIT: event =>
    `User ${event.user?.email} tried to join ${event.getOrganizationName()} with an expired/invalid invite.`,
  PROJECT_CREATED: event =>
    `User ${event.user?.email} created a project named ${event.getProjectName()}.`,
  TARGET_CREATED: event => `User ${event.user?.email} created a target named ${event.targetId}.`,
  ROLE_CREATED: event => `Admin ${event.user?.email} created a new role ${event.details.role}.`,
  ROLE_ASSIGNED: event =>
    `Admin ${event.user?.email} assigned a new role to user ${event.details.user}.`,
  USER_REMOVED: event => `Admin ${event.user?.email} removed user ${event.details.user}.`,
  ORGANIZATION_TRANSFERRED: event =>
    `Admin ${event.user?.email} transferred ownership to ${event.details.newOwner}.`,
  SCHEMA_CHECKED: event => `CI made a schema check for ${event.getProjectName()}.`,
  SCHEMA_PUBLISHED: event =>
    `User ${event.user?.email} published a new schema version for project ${event.getProjectName()}.`,
  SCHEMA_DELETED: _event => `Hive background job deleted old schema.`,
  PROJECT_SETTINGS_UPDATED: event =>
    `Changes made to project ${event.getProjectName()} settings by ${event.user?.email}.`,
  ORGANIZATION_SETTINGS_UPDATED: event =>
    `Changes made to organization ${event.getOrganizationName()} settings by ${event.user?.email}.`,
  TARGET_SETTINGS_UPDATED: event =>
    `Changes made to target ${event.targetId} settings by ${event.user?.email}.`,
  SCHEMA_POLICY_SETTINGS_UPDATED: event =>
    `Changes made to schema policy settings under an org or a project by ${event.user?.email}.`,
};

export function renderEventHumanReadable(event: AuditLogEventWithMethods): string {
  const renderer = eventRenderers[event.eventAction](event);

  if (!renderer) {
    throw new Error(`No renderer found for event action: ${event.eventAction}`);
  }

  return renderer;
}
