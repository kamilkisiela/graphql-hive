import { BillingProvider } from '../providers/billing.provider';
import type { BillingPlanType, OrganizationResolvers } from './../../../__generated__/types.next';

export const Organization: Pick<
  OrganizationResolvers,
  'billingConfiguration' | 'plan' | '__isTypeOf'
> = {
  plan: org => (org.billingPlan || 'HOBBY') as BillingPlanType,
  billingConfiguration: async (org, _args, { injector }) => {
    if (org.billingPlan === 'ENTERPRISE') {
      return {
        hasActiveSubscription: true,
        canUpdateSubscription: false,
        hasPaymentIssues: false,
        paymentMethod: null,
        billingAddress: null,
        invoices: null,
        upcomingInvoice: null,
      };
    }

    const billingRecord = await injector
      .get(BillingProvider)
      .getOrganizationBillingParticipant({ organizationId: org.id });

    if (!billingRecord) {
      return {
        hasActiveSubscription: false,
        canUpdateSubscription: true,
        hasPaymentIssues: false,
        paymentMethod: null,
        billingAddress: null,
        invoices: null,
        upcomingInvoice: null,
      };
    }

    // This is a special case where customer is on Pro and doesn't have a record for external billing.
    // This happens when the customer is paying through an external system and not through Stripe.
    if (org.billingPlan === 'PRO' && billingRecord.externalBillingReference === 'wire') {
      return {
        hasActiveSubscription: true,
        canUpdateSubscription: false,
        hasPaymentIssues: false,
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
        canUpdateSubscription: true,
        hasPaymentIssues: false,
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

    const hasPaymentIssues = invoices?.some(
      i => i.charge !== null && typeof i.charge === 'object' && i.charge?.failure_code !== null,
    );

    return {
      hasActiveSubscription: subscriptionInfo.subscription !== null,
      canUpdateSubscription: subscriptionInfo.subscription !== null,
      hasPaymentIssues,
      paymentMethod: subscriptionInfo.paymentMethod?.card || null,
      billingAddress: subscriptionInfo.paymentMethod?.billing_details || null,
      invoices,
      upcomingInvoice,
    };
  },
};
