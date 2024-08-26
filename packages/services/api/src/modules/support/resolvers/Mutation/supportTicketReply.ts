import { AuditLogManager } from '../../../audit-logs/providers/audit-logs-manager';
import { AuthManager } from '../../../auth/providers/auth-manager';
import { IdTranslator } from '../../../shared/providers/id-translator';
import { SupportManager } from '../../providers/support-manager';
import type { MutationResolvers } from './../../../../__generated__/types.next';

export const supportTicketReply: NonNullable<MutationResolvers['supportTicketReply']> = async (
  _,
  { input },
  { injector },
) => {
  const organizationId = await injector.get(IdTranslator).translateOrganizationId(input);
  const response = await injector.get(SupportManager).replyToTicket({
    organizationId,
    ...input,
  });

  const currentUser = await injector.get(AuthManager).getCurrentUser();
  injector.get(AuditLogManager).createLogAuditEvent(
    {
      eventType: 'SUPPORT_TICKET_UPDATED',
      supportTicketUpdatedAuditLogSchema: {
        ticketId: input.ticketId,
        updatedFields: JSON.stringify({
          organization: input.organization,
          body: input.body,
        }),
      },
    },
    {
      organizationId: organizationId,
      userEmail: currentUser.email,
      userId: currentUser.id,
      user: currentUser,
    },
  );

  return response;
};
