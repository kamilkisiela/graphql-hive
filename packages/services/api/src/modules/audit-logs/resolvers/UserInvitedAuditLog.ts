import { resolveRecordAuditLog } from '../helpers';
import type { UserInvitedAuditLogResolvers } from './../../../__generated__/types.next';

export const UserInvitedAuditLog: UserInvitedAuditLogResolvers = {
  __isTypeOf: e => e.event_action === 'USER_INVITED',
  eventTime: e => new Date(e.event_time).toISOString(),
  inviteeEmail: e => e.metadata.userInvitedAuditLogSchema.inviteeEmail,
  inviteeId: e => e.metadata.userInvitedAuditLogSchema.inviteeId,
  record: (e, _, { injector }) => resolveRecordAuditLog(e, injector),
};
