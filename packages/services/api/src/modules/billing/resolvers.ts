import { GraphQLError } from 'graphql';
import { TRPCClientError } from '@trpc/client';
import { AuthManager } from '../auth/providers/auth-manager';
import { OrganizationAccessScope } from '../auth/providers/organization-access';
import { OrganizationManager } from '../organization/providers/organization-manager';
import { IdTranslator } from '../shared/providers/id-translator';
import { BillingModule } from './__generated__/types';
import { BillingProvider } from './providers/billing.provider';

const USAGE_DEFAULT_LIMITATIONS: Record<
  'HOBBY' | 'PRO' | 'ENTERPRISE',
  { operations: number; retention: number }
> = {
  HOBBY: {
    operations: 1_000_000,
    retention: 7,
  },
  PRO: {
    operations: 0,
    retention: 90,
  },
  ENTERPRISE: {
    operations: 0, // unlimited
    retention: 365,
  },
};

export const resolvers: BillingModule.Resolvers = {
  Mutation: {
    downgradeToHobby: async (_, args, { injector }) => {
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
    },
    upgradeToPro: async (root, args, { injector }) => {
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
            operations:
              args.input.monthlyLimits.operations || USAGE_DEFAULT_LIMITATIONS.PRO.operations,
          },
        });

        return {
          previousPlan: 'HOBBY',
          newPlan: 'PRO',
          organization,
        };
      }

      throw new GraphQLError(`Unable to upgrade to Pro from your current plan`);
    },
  },
};
