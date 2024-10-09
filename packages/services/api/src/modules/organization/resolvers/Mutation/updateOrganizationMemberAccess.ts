import { IdTranslator } from '../../../shared/providers/id-translator';
import { OrganizationManager } from '../../providers/organization-manager';
import type { MutationResolvers } from './../../../../__generated__/types.next';

export const updateOrganizationMemberAccess: NonNullable<
  MutationResolvers['updateOrganizationMemberAccess']
> = async (_, { input }, { injector }) => {
  const organization = await injector.get(IdTranslator).translateOrganizationId(input);

  return {
    selector: {
      organization: input.organization,
    },
    organization: await injector.get(OrganizationManager).updateMemberAccess({
      organization,
      user: input.user,
      organizationScopes: input.organizationScopes,
      projectScopes: input.projectScopes,
      targetScopes: input.targetScopes,
    }),
  };
};
