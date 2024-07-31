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
  Query: {
    billingPlans: async (root, args, { injector }) => {
      const availablePrices = await injector.get(BillingProvider).getAvailablePrices();

      if (!availablePrices) {
        return [];
      }

      return [
        {
          id: 'HOBBY',
          planType: 'HOBBY',
          basePrice: 0,
          name: 'Hobby',
          description: 'Free for non-commercial use, startups, side-projects and just experiments.',
          includedOperationsLimit: USAGE_DEFAULT_LIMITATIONS.HOBBY.operations,
          rateLimit: 'MONTHLY_LIMITED',
          pricePerOperationsUnit: 0,
          retentionInDays: USAGE_DEFAULT_LIMITATIONS.HOBBY.retention,
        },
        {
          id: 'PRO',
          planType: 'PRO',
          basePrice: availablePrices.basePrice.unit_amount! / 100,
          name: 'Pro',
          description:
            'For production-ready applications that requires long retention, high ingestion capacity.',
          includedOperationsLimit: USAGE_DEFAULT_LIMITATIONS.PRO.operations,
          pricePerOperationsUnit: availablePrices.operationsPrice.tiers![1].unit_amount! / 100,
          retentionInDays: USAGE_DEFAULT_LIMITATIONS.PRO.retention,
          rateLimit: 'MONTHLY_QUOTA',
        },
        {
          id: 'ENTERPRISE',
          planType: 'ENTERPRISE',
          name: 'Enterprise',
          description:
            'For enterprise and organization that requires custom setup and custom data ingestion rates.',
          includedOperationsLimit: USAGE_DEFAULT_LIMITATIONS.ENTERPRISE.operations,
          retentionInDays: USAGE_DEFAULT_LIMITATIONS.ENTERPRISE.retention,
          rateLimit: 'UNLIMITED',
        },
      ];
    },
  },
  Mutation: {
    generateStripePortalLink: async (_, args, { injector }) => {
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
    },
    updateOrgRateLimit: async (_, args, { injector }) => {
      const organizationId = await injector.get(IdTranslator).translateOrganizationId({
        organization: args.selector.organization,
      });

      return injector.get(OrganizationManager).updateRateLimits({
        organization: organizationId,
        monthlyRateLimit: {
          retentionInDays: USAGE_DEFAULT_LIMITATIONS.PRO.retention,
          operations: args.monthlyLimits.operations,
        },
      });
    },
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
