import { Inject, Injectable, Scope } from 'graphql-modules';
import type { StripeBillingApi } from '@hive/stripe-billing';
import { createTRPCProxyClient, httpLink } from '@trpc/client';
import { BillingInvoiceStatus } from '../../../__generated__/types';
import { Logger } from '../../shared/providers/logger';
import {
  BillingDataProvider,
  BillingInfo,
  BillingInvoice,
  BillingPrices,
  FuturePayment,
  Subscription,
} from './base-provider';
import { BILLING_CONFIG, type BillingConfig } from './tokens';

@Injectable({
  global: true,
  scope: Scope.Singleton,
})
export class StripeBillingProvider implements BillingDataProvider {
  private logger: Logger;
  private serviceInstance;

  constructor(logger: Logger, @Inject(BILLING_CONFIG) billingConfig: BillingConfig) {
    this.logger = logger.child({ source: 'BillingProvider' });
    this.serviceInstance = billingConfig.stripeServiceEndpoint
      ? createTRPCProxyClient<StripeBillingApi>({
          links: [httpLink({ url: `${billingConfig.stripeServiceEndpoint}/trpc`, fetch })],
        })
      : null;
  }

  private get service() {
    if (!this.serviceInstance) {
      throw new Error('Stripe service is not configured');
    }

    return this.serviceInstance;
  }

  async billingInfo(customerId: string): Promise<BillingInfo> {
    const info = await this.service.customerInfo.query({ customerId });

    return {
      billingEmail: info?.email ?? null,
      legalName: info?.name ?? null,
      taxId: info?.tax_ids?.data?.[0].value ?? null,
      paymentMethod: null,
    };
  }

  async getAvailablePrices(): Promise<BillingPrices> {
    const prices = await this.service.availablePrices.query();

    return {
      basePrice: {
        identifier: prices.basePrice.id,
        amount: prices.basePrice.unit_amount!,
      },
      pricePerMillionOperations: {
        identifier: prices.operationsPrice.id,
        amount: prices.operationsPrice.tiers![1].unit_amount!,
      },
    };
  }

  async getActiveSubscription(customerId: string): Promise<Subscription | null> {
    const activeSubscriptionResult = await this.service.activeSubscription.query({
      customerId,
    });

    if (!activeSubscriptionResult) {
      return null;
    }

    return {
      id: activeSubscriptionResult.subscription.id,
      trialEnd: activeSubscriptionResult.subscription.trial_end ?? null,
    };
  }

  async invoices(customerId: string): Promise<BillingInvoice[]> {
    const invoices = await this.service.invoices.query({
      customerId,
    });

    return invoices.map(invoice => ({
      id: invoice.id,
      date: new Date(invoice.created),
      pdfUrl: invoice.invoice_pdf!,
      amount: invoice.total!,
      periodStart: new Date(invoice.period_start),
      periodEnd: new Date(invoice.period_end),
      status: invoice?.status ? (invoice.status.toUpperCase() as BillingInvoiceStatus) : 'DRAFT',
    }));
  }

  async cancelActiveSubscription(customerId: string): Promise<void> {
    await this.service.cancelSubscriptionForOrganization.mutate({
      customerId,
    });
  }

  async hasPaymentIssues(customerId: string): Promise<boolean> {
    const invoices = await this.service.invoices.query({
      customerId,
    });

    return invoices?.some(
      i => i.charge !== null && typeof i.charge === 'object' && i.charge?.failure_code !== null,
    );
  }

  async syncOperationsLimit(
    customerId: string,
    _organizationId: string,
    operationsInMillions: number,
  ): Promise<void> {
    return await this.service.syncOrganizationToStripe.mutate({
      customerId,
      reserved: {
        operations: operationsInMillions,
      },
    });
  }

  async upcomingPayment(customerId: string): Promise<FuturePayment | null> {
    const upcomingInvoice = await this.service.upcomingInvoice.query({
      customerId,
    });

    if (!upcomingInvoice) {
      return null;
    }

    return {
      date: new Date(upcomingInvoice.created),
      amount: upcomingInvoice.total!,
    };
  }

  async subscriptionManagementUrl(customerId: string) {
    return await this.service.generateStripePortalLink.mutate({
      customerId,
    });
  }
}
