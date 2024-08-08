import { OrganizationAccessScope } from '../../../auth/providers/organization-access';
import { OrganizationManager } from '../../../organization/providers/organization-manager';
import { IdTranslator } from '../../../shared/providers/id-translator';
import { BillingProvider } from '../../providers/billing.provider';
import type { MutationResolvers } from './../../../../__generated__/types.next';

export const generateStripePortalLink: NonNullable<
  MutationResolvers['generateStripePortalLink']
> = async (_, args, { injector }) => {
  const organizationId = await injector.get(IdTranslator).translateOrganizationId({
    organization: args.selector.organization,
  });
  const organization = await injector.get(OrganizationManager).getOrganization(
    {
      organization: organizationId,
    },
    OrganizationAccessScope.SETTINGS,
  );

  return injector.get(BillingProvider).generateStripePortalLink(organization.id);
};
