import { resolveRecordAuditLog } from '../helpers';
import type { UserRemovedAuditLogResolvers } from './../../../__generated__/types.next';

export const UserRemovedAuditLog: UserRemovedAuditLogResolvers = {
  __isTypeOf: e => e.event_action === 'USER_REMOVED',
  eventTime: e => new Date(e.event_time).toISOString(),
  removedUserEmail: e => e.metadata.userRemovedAuditLogSchema.removedUserEmail,
  removedUserId: e => e.metadata.userRemovedAuditLogSchema.removedUserId,
  record: (e, _, { injector }) => resolveRecordAuditLog(e, injector),
};
