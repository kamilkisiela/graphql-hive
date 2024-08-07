import { GraphQLError } from 'graphql';
import { TRPCClientError } from '@trpc/client';
import { AuthManager } from '../../../auth/providers/auth-manager';
import { OrganizationAccessScope } from '../../../auth/providers/organization-access';
import { OrganizationManager } from '../../../organization/providers/organization-manager';
import { IdTranslator } from '../../../shared/providers/id-translator';
import { USAGE_DEFAULT_LIMITATIONS } from '../../constants';
import { BillingProvider } from '../../providers/billing.provider';
import type { MutationResolvers } from './../../../../__generated__/types.next';

export const upgradeToPro: NonNullable<MutationResolvers['upgradeToPro']> = async (
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

  if (organization.billingPlan === 'HOBBY') {
    // Configure user to use Stripe payments, create billing participant record for the org
    try {
      await injector.get(BillingProvider).upgradeToPro({
        organizationId,
        couponCode: args.input.couponCode,
        paymentMethodId: args.input.paymentMethodId,
        reserved: {
          operations: Math.floor(args.input.monthlyLimits.operations / 1_000_000),
        },
      });
    } catch (e) {
      if (e instanceof TRPCClientError) {
        throw new GraphQLError(`Falied to upgrade: ${e.message}`);
      }

      throw e;
    }

    // Upgrade the actual org plan to PRO
    organization = await injector
      .get(OrganizationManager)
      .updatePlan({ plan: 'PRO', organization: organizationId });

    // Upgrade the limits
    organization = await injector.get(OrganizationManager).updateRateLimits({
      organization: organizationId,
      monthlyRateLimit: {
        retentionInDays: USAGE_DEFAULT_LIMITATIONS.PRO.retention,
        operations: args.input.monthlyLimits.operations || USAGE_DEFAULT_LIMITATIONS.PRO.operations,
      },
    });

    return {
      previousPlan: 'HOBBY',
      newPlan: 'PRO',
      organization,
    };
  }

  throw new GraphQLError(`Unable to upgrade to Pro from your current plan`);
};
