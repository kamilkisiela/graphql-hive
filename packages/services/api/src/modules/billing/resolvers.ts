import { GraphQLError } from 'graphql';
import { BillingPlanType, BillingProvider as BillingProviderType } from '../../__generated__/types';
import { AuthManager } from '../auth/providers/auth-manager';
import { OrganizationAccessScope } from '../auth/providers/organization-access';
import { OrganizationManager } from '../organization/providers/organization-manager';
import { IdTranslator } from '../shared/providers/id-translator';
import { BillingModule } from './__generated__/types';
import { USAGE_DEFAULT_LIMITATIONS } from './config';
import { BillingProvider } from './providers/billing.provider';

export const resolvers: BillingModule.Resolvers = {
  BillingInvoice: {
    id: i => (i.id === null ? 'upcoming' : i.id),
    amount: i => parseFloat((i.amount / 100).toFixed(2)),
    pdfLink: i => i.pdfUrl || null,
    date: i => i.date.toISOString(),
    periodStart: i => i.periodStart.toISOString(),
    periodEnd: i => i.periodEnd.toISOString(),
    status: i => i.status,
  },
  Organization: {
    plan: org => (org.billingPlan || 'HOBBY') as BillingPlanType,
    billingConfiguration: async (org, _args, { injector }) => {
      if (org.billingPlan === 'ENTERPRISE') {
        return {
          provider: null,
          hasActiveSubscription: true,
          canUpdateSubscription: false,
          hasPaymentIssues: false,
          paymentMethod: null,
          billingAddress: null,
          invoices: null,
          nextPayment: null,
          trialEnd: null,
        };
      }

      const billingRecord = await injector
        .get(BillingProvider)
        .getOrganizationBillingParticipant({ organization: org.id });

      if (!billingRecord) {
        return {
          provider: null,
          hasActiveSubscription: false,
          canUpdateSubscription: true,
          hasPaymentIssues: false,
          invoices: null,
          nextPayment: null,
          trialEnd: null,
        };
      }

      // This is a special case where customer is on Pro and doesn't have a record for external billing.
      // This happens when the customer is paying through an external system and not through Stripe.
      if (
        org.billingPlan === 'PRO' &&
        (billingRecord.provider === 'WIRE' || billingRecord.externalBillingReference === 'wire')
      ) {
        return {
          provider: 'WIRE',
          hasActiveSubscription: true,
          canUpdateSubscription: false,
          hasPaymentIssues: false,
          invoices: null,
          nextPayment: null,
          trialEnd: null,
        };
      }

      const subscriptionInfo = await injector
        .get(BillingProvider)
        .getActiveSubscription(billingRecord);

      // In case we have a customer record but no subscription, we can assume that the customer is on a free plan.
      if (!subscriptionInfo) {
        return {
          provider: billingRecord.provider as BillingProviderType,
          hasActiveSubscription: false,
          canUpdateSubscription: true,
          hasPaymentIssues: false,
          invoices: null,
          nextPayment: null,
          trialEnd: null,
        };
      }

      const [billingInfo, hasPaymentIssues, invoices, nextPayment] = await Promise.all([
        injector.get(BillingProvider).billingInfo(billingRecord),
        injector.get(BillingProvider).hasPaymentIssues(billingRecord),
        injector.get(BillingProvider).invoices(billingRecord),
        injector.get(BillingProvider).upcomingPayment(billingRecord),
      ]);

      return {
        provider: billingRecord.provider as BillingProviderType,
        hasActiveSubscription: subscriptionInfo !== null,
        canUpdateSubscription: subscriptionInfo !== null,
        hasPaymentIssues,
        invoices,
        nextPayment,
        taxId: billingInfo?.taxId || null,
        trialEnd: subscriptionInfo?.trialEnd ? (new Date(subscriptionInfo.trialEnd) as any) : null,
        legalName: billingInfo?.legalName || null,
        billingEmail: billingInfo?.billingEmail || null,
        paymentMethod: billingInfo?.paymentMethod
          ? {
              methodType: billingInfo.paymentMethod.type,
              brand: billingInfo.paymentMethod.brand,
              identifier: billingInfo.paymentMethod.last4,
            }
          : null,
      };
    },
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
          basePrice: {
            id: 'HOBBY_BASE',
            amount: 0,
          },
          name: 'Hobby',
          description: 'Free for non-commercial use, startups, side-projects and just experiments.',
          includedOperationsLimit: USAGE_DEFAULT_LIMITATIONS.HOBBY.operations,
          rateLimit: 'MONTHLY_LIMITED',
          pricePerOperationsUnit: {
            id: 'HOBBY_OPERATIONS',
            amount: 0,
          },
          retentionInDays: USAGE_DEFAULT_LIMITATIONS.HOBBY.retention,
        },
        {
          id: 'PRO',
          planType: 'PRO',
          basePrice: {
            id: availablePrices.basePrice.identifier,
            amount: availablePrices.basePrice.amount / 100,
          },
          name: 'Pro',
          description:
            'For production-ready applications that requires long retention, high ingestion capacity.',
          includedOperationsLimit: USAGE_DEFAULT_LIMITATIONS.PRO.operations,
          pricePerOperationsUnit: {
            id: availablePrices.pricePerMillionOperations.identifier,
            amount: availablePrices.pricePerMillionOperations.amount / 100,
          },
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
    generatePaymentMethodUpdateToken: async (_, args, { injector }) => {
      const organizationId = await injector.get(IdTranslator).translateOrganizationId({
        organization: args.selector.organization,
      });
      const organization = await injector.get(OrganizationManager).getOrganization(
        {
          organization: organizationId,
        },
        OrganizationAccessScope.SETTINGS,
      );

      const billingRecord = await injector
        .get(BillingProvider)
        .getOrganizationBillingParticipant({ organization: organization.id });

      if (!billingRecord) {
        throw new Error('Organization does not have billing record');
      }

      return await injector.get(BillingProvider).generatePaymentMethodUpdateToken(billingRecord);
    },
    updateBillingDetails: async (_, args, { injector }) => {
      const organizationId = await injector.get(IdTranslator).translateOrganizationId({
        organization: args.input.selector.organization,
      });
      const organization = await injector.get(OrganizationManager).getOrganization(
        {
          organization: organizationId,
        },
        OrganizationAccessScope.SETTINGS,
      );

      const billingRecord = await injector
        .get(BillingProvider)
        .getOrganizationBillingParticipant({ organization: organization.id });

      if (!billingRecord) {
        throw new Error('Organization does not have billing record');
      }

      await injector.get(BillingProvider).updateBillingDetails(billingRecord, {
        legalName: args.input.legalName ?? null,
        taxId: args.input.taxId ?? null,
        billingEmail: args.input.billingEmail ?? null,
      });

      return organization;
    },
    generateSubscriptionManagementLink: async (_, args, { injector }) => {
      const organizationId = await injector.get(IdTranslator).translateOrganizationId({
        organization: args.selector.organization,
      });
      const organization = await injector.get(OrganizationManager).getOrganization(
        {
          organization: organizationId,
        },
        OrganizationAccessScope.SETTINGS,
      );
      const billingRecord = await injector
        .get(BillingProvider)
        .getOrganizationBillingParticipant({ organization: organization.id });

      if (!billingRecord) {
        throw new Error('Organization does not have billing record');
      }

      const record = await injector.get(BillingProvider).subscriptionManagementUrl(billingRecord);

      if (!record) {
        throw new Error('Failed to get subscription management URL');
      }

      return record;
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

      const billingRecord = await injector
        .get(BillingProvider)
        .getOrganizationBillingParticipant({ organization: organization.id });

      if (organization.billingPlan === 'PRO' && billingRecord) {
        // Configure user to use Stripe payments, create billing participant record for the org
        await injector.get(BillingProvider).downgradeToHobby(billingRecord);

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
  },
};
