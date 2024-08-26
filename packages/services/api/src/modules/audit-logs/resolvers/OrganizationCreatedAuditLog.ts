import { resolveRecordAuditLog } from '../helpers';
import type { OrganizationCreatedAuditLogResolvers } from './../../../__generated__/types.next';

/*
 * Note: This object type is generated because "OrganizationCreatedAuditLogMapper" is declared. This is to ensure runtime safety.
 *
 * When a mapper is used, it is possible to hit runtime errors in some scenarios:
 * - given a field name, the schema type's field type does not match mapper's field type
 * - or a schema type's field does not exist in the mapper's fields
 *
 * If you want to skip this file generation, remove the mapper or update the pattern in the `resolverGeneration.object` config.
 */
export const OrganizationCreatedAuditLog: OrganizationCreatedAuditLogResolvers = {
  __isTypeOf: e => e.event_action === 'ORGANIZATION_CREATED',
  eventTime: e => new Date(e.event_time).toISOString(),
  organizationId: e => e.metadata.organizationCreatedAuditLogSchema.organizationId,
  organizationName: e => e.metadata.organizationCreatedAuditLogSchema.organizationName,
  record: (e, _, { injector }) => resolveRecordAuditLog(e, injector),
};
