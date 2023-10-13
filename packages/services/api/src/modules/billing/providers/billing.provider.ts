import { Inject, Injectable, Scope } from 'graphql-modules';
import type { StripeBillingApi, StripeBillingApiInput } from '@hive/stripe-billing';
import { createTRPCProxyClient, httpLink } from '@trpc/client';
import { OrganizationSelector } from '../../../__generated__/types';
import { OrganizationBilling } from '../../../shared/entities';
import { Logger } from '../../shared/providers/logger';
import { Storage } from '../../shared/providers/storage';
import type { BillingConfig } from './tokens';
import { BILLING_CONFIG } from './tokens';

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
    this.logger.debug('Upgrading to PRO (input=%o)', input);
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
    this.logger.debug('Getting available prices');
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
    this.logger.debug('Fetching active subscription (input=%o)', input);
    if (!this.billingService) {
      throw new Error(`Billing service is not configured!`);
    }

    return this.billingService.activeSubscription.query(input);
  }

  invoices(input: StripeBillingApiInput['invoices']) {
    this.logger.debug('Fetching invoices (input=%o)', input);
    if (!this.billingService) {
      throw new Error(`Billing service is not configured!`);
    }

    return this.billingService.invoices.query(input);
  }

  upcomingInvoice(input: StripeBillingApiInput['upcomingInvoice']) {
    this.logger.debug('Fetching upcoming invoices (input=%o)', input);
    if (!this.billingService) {
      throw new Error(`Billing service is not configured!`);
    }

    return this.billingService.upcomingInvoice.query(input);
  }

  async downgradeToHobby(input: StripeBillingApiInput['cancelSubscriptionForOrganization']) {
    this.logger.debug('Downgrading to Hobby (input=%o)', input);
    if (!this.billingService) {
      throw new Error(`Billing service is not configured!`);
    }

    return await this.billingService.cancelSubscriptionForOrganization.mutate(input);
  }

  async generateStripePortalLink(orgId: string) {
    this.logger.debug('Generating Stripe portal link for id:' + orgId);

    if (!this.billingService) {
      throw new Error(`Billing service is not configured!`);
    }

    return await this.billingService.generateStripePortalLink.mutate({
      organizationId: orgId,
    });
  }
}
