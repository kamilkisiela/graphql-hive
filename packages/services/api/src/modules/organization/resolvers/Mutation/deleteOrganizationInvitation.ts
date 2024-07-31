import { IdTranslator } from '../../../shared/providers/id-translator';
import { OrganizationManager } from '../../providers/organization-manager';
import type { MutationResolvers } from './../../../../__generated__/types.next';

export const deleteOrganizationInvitation: NonNullable<
  MutationResolvers['deleteOrganizationInvitation']
> = async (_, { input }, { injector }) => {
  const organizationId = await injector.get(IdTranslator).translateOrganizationId(input);
  const invitation = await injector
    .get(OrganizationManager)
    .deleteInvitation({ organization: organizationId, email: input.email });

  if (invitation) {
    return {
      ok: invitation,
    };
  }

  return {
    error: {
      message: 'Invitation not found',
    },
  };
};
