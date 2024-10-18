import { IdTranslator } from '../../../shared/providers/id-translator';
import { OrganizationManager } from '../../providers/organization-manager';
import type { MutationResolvers } from './../../../../__generated__/types.next';

export const deleteOrganization: NonNullable<MutationResolvers['deleteOrganization']> = async (
  _,
  { selector },
  { injector },
) => {
  const translator = injector.get(IdTranslator);
  const organizationId = await translator.translateOrganizationId({
    organizationSlug: selector.organizationSlug,
  });
  const organization = await injector.get(OrganizationManager).deleteOrganization({
    organization: organizationId,
  });
  return {
    selector: {
      organizationSlug: organization.slug,
    },
    organization,
  };
};
