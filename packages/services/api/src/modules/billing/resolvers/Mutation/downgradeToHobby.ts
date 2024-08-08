import { GraphQLError } from 'graphql';
import { AuthManager } from '../../../auth/providers/auth-manager';
import { OrganizationAccessScope } from '../../../auth/providers/organization-access';
import { OrganizationManager } from '../../../organization/providers/organization-manager';
import { IdTranslator } from '../../../shared/providers/id-translator';
import { USAGE_DEFAULT_LIMITATIONS } from '../../constants';
import { BillingProvider } from '../../providers/billing.provider';
import type { MutationResolvers } from './../../../../__generated__/types.next';

export const downgradeToHobby: NonNullable<MutationResolvers['downgradeToHobby']> = async (
  _,
  args,
  { injector },
) => {
  const organizationId = await injector.get(IdTranslator).translateOrganizationId({
    organization: args.input.organization.organization,
  });
  await injector.get(AuthManager).ensureOrganizationAccess({
    organization: organizationId,
    scope: OrganizationAccessScope.SETTINGS,
  });

  let organization = await injector.get(OrganizationManager).getOrganization({
    organization: organizationId,
  });

  if (organization.billingPlan === 'PRO') {
    // Configure user to use Stripe payments, create billing participant record for the org
    await injector.get(BillingProvider).downgradeToHobby({
      organizationId,
    });

    // Upgrade the actual org plan to HOBBY
    organization = await injector
      .get(OrganizationManager)
      .updatePlan({ plan: 'HOBBY', organization: organizationId });

    // Upgrade the limits
    organization = await injector.get(OrganizationManager).updateRateLimits({
      organization: organizationId,
      monthlyRateLimit: {
        retentionInDays: USAGE_DEFAULT_LIMITATIONS.HOBBY.retention,
        operations: USAGE_DEFAULT_LIMITATIONS.HOBBY.operations,
      },
    });

    return {
      previousPlan: 'PRO',
      newPlan: 'HOBBY',
      organization,
    };
  }
  throw new GraphQLError(`Unable to downgrade from Pro from your current plan`);
};
