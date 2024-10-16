import { resolveRecordAuditLog } from '../helpers';
import type { AppDeploymentUpdatedAuditLogResolvers } from './../../../__generated__/types.next';

/*
 * Note: This object type is generated because "AppDeploymentUpdatedAuditLogMapper" is declared. This is to ensure runtime safety.
 *
 * When a mapper is used, it is possible to hit runtime errors in some scenarios:
 * - given a field name, the schema type's field type does not match mapper's field type
 * - or a schema type's field does not exist in the mapper's fields
 *
 * If you want to skip this file generation, remove the mapper or update the pattern in the `resolverGeneration.object` config.
 */
export const AppDeploymentUpdatedAuditLog: AppDeploymentUpdatedAuditLogResolvers = {
  __isTypeOf: e => e.event_action === 'APP_DEPLOYMENT_UPDATED',
  eventTime: e => new Date(e.event_time).toISOString(),
  deploymentId: e => e.metadata.appDeploymentCreatedAuditLogSchema.deploymentId,
  updatedFields: e => e.metadata.appDeploymentUpdatedAuditLogSchema.updatedFields,
  record: (e, _, { injector }) => resolveRecordAuditLog(e, injector),
};
