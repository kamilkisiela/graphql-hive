import { Inject, Injectable, Scope } from 'graphql-modules';
import { Logger } from '../../shared/providers/logger';
import { BILLING_CONFIG } from './tokens';
import type { BillingConfig } from './tokens';
import type { StripeBillingApi, StripeBillingApiInput } from '@hive/stripe-billing';
import { createTRPCProxyClient, httpLink } from '@trpc/client';
import { fetch } from '@whatwg-node/fetch';
import { OrganizationSelector } from '../../../__generated__/types';
import { OrganizationBilling } from '../../../shared/entities';
import { Storage } from '../../shared/providers/storage';

@Injectable({
  global: true,
  scope: Scope.Singleton,
})
export class BillingProvider {
  private logger: Logger;
  private billingService;

  enabled = false;

  constructor(
    logger: Logger,
    private storage: Storage,
    @Inject(BILLING_CONFIG) billingConfig: BillingConfig,
  ) {
    this.logger = logger.child({ source: 'BillingProvider' });
    this.billingService = billingConfig.endpoint
      ? createTRPCProxyClient<StripeBillingApi>({
          links: [httpLink({ url: `${billingConfig.endpoint}/trpc`, fetch })],
        })
      : null;

    if (billingConfig.endpoint) {
      this.enabled = true;
    }
  }

  upgradeToPro(input: StripeBillingApiInput['createSubscriptionForOrganization']) {
    if (!this.billingService) {
      throw new Error(`Billing service is not configured!`);
    }

    return this.billingService.createSubscriptionForOrganization.mutate(input);
  }

  syncOrganization(input: StripeBillingApiInput['syncOrganizationToStripe']) {
    if (!this.billingService) {
      throw new Error(`Billing service is not configured!`);
    }

    return this.billingService.syncOrganizationToStripe.mutate(input);
  }

  async getAvailablePrices() {
    if (!this.billingService) {
      return null;
    }

    return await this.billingService.availablePrices.query();
  }

  async getOrganizationBillingParticipant(
    selector: OrganizationSelector,
  ): Promise<OrganizationBilling | null> {
    this.logger.debug('Fetching organization billing (selector=%o)', selector);

    return this.storage.getOrganizationBilling({
      organization: selector.organization,
    });
  }

  getActiveSubscription(input: StripeBillingApiInput['activeSubscription']) {
    if (!this.billingService) {
      throw new Error(`Billing service is not configured!`);
    }

    return this.billingService.activeSubscription.query(input);
  }

  invoices(input: StripeBillingApiInput['invoices']) {
    if (!this.billingService) {
      throw new Error(`Billing service is not configured!`);
    }

    return this.billingService.invoices.query(input);
  }

  upcomingInvoice(input: StripeBillingApiInput['upcomingInvoice']) {
    if (!this.billingService) {
      throw new Error(`Billing service is not configured!`);
    }

    return this.billingService.upcomingInvoice.query(input);
  }

  async downgradeToHobby(input: StripeBillingApiInput['cancelSubscriptionForOrganization']) {
    if (!this.billingService) {
      throw new Error(`Billing service is not configured!`);
    }

    return await this.billingService.cancelSubscriptionForOrganization.mutate(input);
  }
}
