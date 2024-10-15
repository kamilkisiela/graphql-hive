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

export function formatToClickhouseDateTime(date: string): string {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}
