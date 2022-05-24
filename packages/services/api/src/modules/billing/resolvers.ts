import { EnvelopError } from '@graphql-yoga/common';
import { BillingPlanType } from '../../__generated__/types';
import { AuthManager } from '../auth/providers/auth-manager';
import { OrganizationAccessScope } from '../auth/providers/organization-access';
import { OrganizationManager } from '../organization/providers/organization-manager';
import { IdTranslator } from '../shared/providers/id-translator';
import { BillingProvider } from './providers/billing.provider';
import { BillingModule } from './__generated__/types';

const USAGE_DEFAULT_LIMITATIONS: Record<
  'HOBBY' | 'PRO' | 'ENTERPRISE',
  { operations: number; schemaPushes: number; retention: number }
> = {
  HOBBY: {
    operations: 1_000_000,
    schemaPushes: 50,
    retention: 3,
  },
  PRO: {
    operations: 5_000_000,
    schemaPushes: 500,
    retention: 180,
  },
  ENTERPRISE: {
    operations: 0, // unlimited
    schemaPushes: 0, // unlimited
    retention: 360,
  },
};

export const resolvers: BillingModule.Resolvers = {
  BillingInvoice: {
    id: i => i.id || 'upcoming',
    amount: i => parseFloat((i.total / 100).toFixed(2)),
    pdfLink: i => i.invoice_pdf || null,
    date: i => new Date(i.created * 1000).toISOString(),
    periodStart: i => new Date(i.period_start * 1000).toISOString(),
    periodEnd: i => new Date(i.period_end * 1000).toISOString(),
  },
  Organization: {
    plan: org => (org.billingPlan || 'HOBBY') as BillingPlanType,
    billingConfiguration: async (org, _args, { injector }) => {
      const billingRecord = await injector
        .get(BillingProvider)
        .getOrganizationBillingParticipant({ organization: org.id });

      if (!billingRecord) {
        return {
          hasActiveSubscription: false,
          paymentMethod: null,
          billingAddress: null,
          invoices: null,
          upcomingInvoice: null,
        };
      }

      const subscriptionInfo = await injector.get(BillingProvider).getActiveSubscription({
        organizationId: billingRecord.organizationId,
      });

      if (!subscriptionInfo) {
        return {
          hasActiveSubscription: false,
          paymentMethod: null,
          billingAddress: null,
          invoices: null,
          upcomingInvoice: null,
        };
      }

      const [invoices, upcomingInvoice] = await Promise.all([
        injector.get(BillingProvider).invoices({
          organizationId: billingRecord.organizationId,
        }),
        injector.get(BillingProvider).upcomingInvoice({
          organizationId: billingRecord.organizationId,
        }),
      ]);

      return {
        hasActiveSubscription: subscriptionInfo.subscription !== null,
        paymentMethod: subscriptionInfo.paymentMethod?.card || null,
        billingAddress: subscriptionInfo.paymentMethod?.billing_details || null,
        invoices,
        upcomingInvoice,
      };
    },
  },
  BillingPaymentMethod: {
    brand: bpm => bpm.brand,
    last4: bpm => bpm.last4,
    expMonth: bpm => bpm.exp_month,
    expYear: bpm => bpm.exp_year,
  },
  BillingDetails: {
    city: bd => bd.address?.city || null,
    country: bd => bd.address?.country || null,
    line1: bd => bd.address?.line1 || null,
    line2: bd => bd.address?.line2 || null,
    postalCode: bd => (bd.address?.postal_code ? parseInt(bd.address?.postal_code) : null),
    state: bd => bd.address?.state || null,
  },
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
          includedSchemaPushLimit: USAGE_DEFAULT_LIMITATIONS.HOBBY.schemaPushes,
          rateLimit: 'MONTHLY_LIMITED',
          pricePerOperationsUnit: 0,
          pricePerSchemaPushUnit: 0,
          retentionInDays: USAGE_DEFAULT_LIMITATIONS.HOBBY.retention,
        },
        {
          id: 'PRO',
          planType: 'PRO',
          basePrice: availablePrices.basePrice.unit_amount! / 100,
          name: 'Pro',
          description:
            'For production-ready applications that requires long retention, high ingestion capacity and unlimited access to all Hive features.',
          includedOperationsLimit: USAGE_DEFAULT_LIMITATIONS.PRO.operations,
          includedSchemaPushLimit: USAGE_DEFAULT_LIMITATIONS.PRO.schemaPushes,
          pricePerOperationsUnit: availablePrices.operationsPrice.tiers![1].unit_amount! / 100,
          pricePerSchemaPushUnit: availablePrices.schemaPushesPrice.tiers![1].unit_amount! / 100,
          retentionInDays: USAGE_DEFAULT_LIMITATIONS.PRO.retention,
          rateLimit: 'MONTHLY_QUOTA',
        },
        {
          id: 'ENTERPRISE',
          planType: 'ENTERPRISE',
          name: 'Enterprise',
          description: 'For enterprise and organization that requires custom setup and custn data ingestion rates.',
          includedOperationsLimit: USAGE_DEFAULT_LIMITATIONS.ENTERPRISE.operations,
          includedSchemaPushLimit: USAGE_DEFAULT_LIMITATIONS.ENTERPRISE.schemaPushes,
          retentionInDays: USAGE_DEFAULT_LIMITATIONS.ENTERPRISE.retention,
          rateLimit: 'UNLIMITED',
        },
      ];
    },
  },
  Mutation: {
    updateOrgRateLimit: async (_, args, { injector }) => {
      const organizationId = await injector.get(IdTranslator).translateOrganizationId({
        organization: args.selector.organization,
      });

      return injector.get(OrganizationManager).updateRateLimits({
        organization: organizationId,
        monthlyRateLimit: {
          retentionInDays: USAGE_DEFAULT_LIMITATIONS.PRO.retention,
          operations: args.monthlyLimits.operations,
          schemaPush: args.monthlyLimits.schemaPushes,
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
            schemaPush: USAGE_DEFAULT_LIMITATIONS.HOBBY.schemaPushes,
          },
        });

        return {
          previousPlan: 'PRO',
          newPlan: 'HOBBY',
          organization,
        };
      }
      throw new EnvelopError(`Unable to downgrade from Pro from your current plan`);
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
        await injector.get(BillingProvider).upgradeToPro({
          organizationId,
          couponCode: args.input.couponCode,
          paymentMethodId: args.input.paymentMethodId,
          reserved: {
            operations: Math.floor(args.input.monthlyLimits.operations / 1_000_000),
            schemaPushes: args.input.monthlyLimits.schemaPushes,
          },
        });

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
            schemaPush: args.input.monthlyLimits.schemaPushes || USAGE_DEFAULT_LIMITATIONS.PRO.schemaPushes,
          },
        });

        return {
          previousPlan: 'HOBBY',
          newPlan: 'PRO',
          organization,
        };
      }
      throw new EnvelopError(`Unable to upgrade to Pro from your current plan`);
    },
  },
};
