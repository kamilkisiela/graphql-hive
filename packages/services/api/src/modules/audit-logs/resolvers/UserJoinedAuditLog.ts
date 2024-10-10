import { resolveRecordAuditLog } from '../helpers';
import type { UserJoinedAuditLogResolvers } from './../../../__generated__/types.next';

export const UserJoinedAuditLog: UserJoinedAuditLogResolvers = {
  __isTypeOf: e => e.event_action === 'USER_JOINED',
  eventTime: e => new Date(e.event_time).toISOString(),
  inviteeEmail: e => e.metadata.userJoinedAuditLogSchema.inviteeEmail,
  inviteeId: e => e.metadata.userJoinedAuditLogSchema.inviteeId,
  record: (e, _, { injector }) => resolveRecordAuditLog(e, injector),
};
