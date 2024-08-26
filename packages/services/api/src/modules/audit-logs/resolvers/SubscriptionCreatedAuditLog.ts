import { resolveRecordAuditLog } from '../helpers';
import type { SubscriptionCreatedAuditLogResolvers } from './../../../__generated__/types.next';

/*
 * Note: This object type is generated because "SubscriptionCreatedAuditLogMapper" is declared. This is to ensure runtime safety.
 *
 * When a mapper is used, it is possible to hit runtime errors in some scenarios:
 * - given a field name, the schema type's field type does not match mapper's field type
 * - or a schema type's field does not exist in the mapper's fields
 *
 * If you want to skip this file generation, remove the mapper or update the pattern in the `resolverGeneration.object` config.
 */
export const SubscriptionCreatedAuditLog: SubscriptionCreatedAuditLogResolvers = {
  __isTypeOf: e => e.event_action === 'SUBSCRIPTION_CREATED',
  eventTime: e => new Date(e.event_time).toISOString(),
  newPlan: e => e.metadata.subscriptionCreatedAuditLogSchema.newPlan,
  operations: e => e.metadata.subscriptionCreatedAuditLogSchema.operations,
  paymentMethodId: e => e.metadata.subscriptionCreatedAuditLogSchema.paymentMethodId,
  previousPlan: e => e.metadata.subscriptionCreatedAuditLogSchema.previousPlan,
  record: (e, _, { injector }) => resolveRecordAuditLog(e, injector),
};
