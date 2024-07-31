import { IdTranslator } from '../../../shared/providers/id-translator';
import { OrganizationManager } from '../../providers/organization-manager';
import type { MutationResolvers } from './../../../../__generated__/types.next';

export const deleteOrganizationMember: NonNullable<
  MutationResolvers['deleteOrganizationMember']
> = async (_, { input }, { injector }) => {
  const organizationId = await injector.get(IdTranslator).translateOrganizationId(input);
  const organization = await injector
    .get(OrganizationManager)
    .deleteMember({ organization: organizationId, user: input.user });

  return {
    selector: input,
    organization,
  };
};
