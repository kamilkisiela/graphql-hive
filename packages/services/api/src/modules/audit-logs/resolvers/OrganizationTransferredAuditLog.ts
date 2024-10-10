import { resolveRecordAuditLog } from '../helpers';
import type { OrganizationTransferredAuditLogResolvers } from './../../../__generated__/types.next';

export const OrganizationTransferredAuditLog: OrganizationTransferredAuditLogResolvers = {
  __isTypeOf: e => e.event_action === 'ORGANIZATION_TRANSFERRED',
  eventTime: e => new Date(e.event_time).toISOString(),
  newOwnerEmail: e => e.metadata.organizationTransferredAuditLogSchema.newOwnerEmail,
  newOwnerId: e => e.metadata.organizationTransferredAuditLogSchema.newOwnerId,
  record: (e, _, { injector }) => resolveRecordAuditLog(e, injector),
};
