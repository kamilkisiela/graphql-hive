import { IdTranslator } from '../../../shared/providers/id-translator';
import { OrganizationManager } from '../../providers/organization-manager';
import type { MutationResolvers } from './../../../../__generated__/types.next';

export const updateOrganizationMemberAccess: NonNullable<
  MutationResolvers['updateOrganizationMemberAccess']
> = async (_, { input }, { injector }) => {
  const organizationId = await injector.get(IdTranslator).translateOrganizationId(input);

  return {
    selector: {
      organizationSlug: input.organizationSlug,
    },
    organization: await injector.get(OrganizationManager).updateMemberAccess({
      organization: organizationId,
      user: input.userId,
      organizationScopes: input.organizationScopes,
      projectScopes: input.projectScopes,
      targetScopes: input.targetScopes,
    }),
  };
};
