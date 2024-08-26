import { Injector } from 'graphql-modules';
import { OrganizationManager } from '../organization/providers/organization-manager';
import { AuditLogModel } from './providers/audit-logs-manager';

export function resolveRecordAuditLog(event: AuditLogModel, injector: Injector) {
  const currentOrganization = injector.get(OrganizationManager).getOrganization({
    organization: event.organization_id,
  });
  return {
    userEmail: event.user_email,
    userId: event.user_id,
    organizationId: event.organization_id,
    user: event.metadata.user,
    organization: currentOrganization,
  };
}
