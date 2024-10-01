import { IdTranslator } from '../../../shared/providers/id-translator';
import { OrganizationManager } from '../../providers/organization-manager';
import type { QueryResolvers } from './../../../../__generated__/types.next';

export const organization: NonNullable<QueryResolvers['organization']> = async (
  _,
  { selector },
  { injector },
) => {
  const organization = await injector.get(IdTranslator).translateOrganizationId(selector);

  return {
    selector,
    organization: await injector.get(OrganizationManager).getOrganization({
      organization,
    }),
  };
};
