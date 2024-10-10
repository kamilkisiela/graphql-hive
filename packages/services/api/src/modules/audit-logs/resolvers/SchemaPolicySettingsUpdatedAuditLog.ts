import { resolveRecordAuditLog } from '../helpers';
import type { SchemaPolicySettingsUpdatedAuditLogResolvers } from './../../../__generated__/types.next';

export const SchemaPolicySettingsUpdatedAuditLog: SchemaPolicySettingsUpdatedAuditLogResolvers = {
  __isTypeOf: e => e.event_action === 'SCHEMA_POLICY_SETTINGS_UPDATED',
  eventTime: e => new Date(e.event_time).toISOString(),
  projectId: e => e.metadata.schemaPolicySettingsUpdatedAuditLogSchema.projectId,
  updatedFields: e => e.metadata.schemaPolicySettingsUpdatedAuditLogSchema.updatedFields,
  record: (e, _, { injector }) => resolveRecordAuditLog(e, injector),
};
