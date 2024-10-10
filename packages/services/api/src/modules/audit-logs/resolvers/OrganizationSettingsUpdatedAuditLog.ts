import { resolveRecordAuditLog } from '../helpers';
import type { OrganizationSettingsUpdatedAuditLogResolvers } from './../../../__generated__/types.next';

export const OrganizationSettingsUpdatedAuditLog: OrganizationSettingsUpdatedAuditLogResolvers = {
  __isTypeOf: e => e.event_action === 'ORGANIZATION_SETTINGS_UPDATED',
  eventTime: e => new Date(e.event_time).toISOString(),
  updatedFields: e => e.metadata.projectSettingsUpdatedAuditLogSchema.updatedFields,
  record: (e, _, { injector }) => resolveRecordAuditLog(e, injector),
};
