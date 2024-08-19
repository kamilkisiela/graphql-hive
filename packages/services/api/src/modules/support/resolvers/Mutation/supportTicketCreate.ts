import { IdTranslator } from '../../../shared/providers/id-translator';
import { SupportManager } from '../../providers/support-manager';
import type { MutationResolvers } from './../../../../__generated__/types.next';

export const supportTicketCreate: NonNullable<MutationResolvers['supportTicketCreate']> = async (
  _,
  { input },
  { injector },
) => {
  const organizationId = await injector.get(IdTranslator).translateOrganizationId(input);
  const response = await injector.get(SupportManager).createTicket({
    organizationId,
    ...input,
  });

  return response;
};
