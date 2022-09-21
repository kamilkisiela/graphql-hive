import { Inject, Injectable, Scope } from 'graphql-modules';
import { Logger } from '../../shared/providers/logger';
import { BILLING_CONFIG } from './tokens';
import type { BillingConfig } from './tokens';
import type { StripeBillingApi, StripeBillingMutationInput, StripeBillingQueryInput } from '@hive/stripe-billing';
import { createTRPCClient } from '@trpc/client';
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

  constructor(logger: Logger, private storage: Storage, @Inject(BILLING_CONFIG) billingConfig: BillingConfig) {
    this.logger = logger.child({ source: 'BillingProvider' });
    this.billingService = billingConfig.endpoint
      ? createTRPCClient<StripeBillingApi>({
          url: `${billingConfig.endpoint}/trpc`,
          fetch,
        })
      : null;

    if (billingConfig.endpoint) {
      this.enabled = true;
    }
  }

  upgradeToPro(input: StripeBillingMutationInput<'createSubscriptionForOrganization'>) {
    if (!this.billingService) {
      throw new Error(`Billing service is not configured!`);
    }

    return this.billingService.mutation('createSubscriptionForOrganization', input);
  }

  syncOrganization(input: StripeBillingMutationInput<'syncOrganizationToStripe'>) {
    if (!this.billingService) {
      throw new Error(`Billing service is not configured!`);
    }

    return this.billingService.mutation('syncOrganizationToStripe', input);
  }

  async getAvailablePrices() {
    if (!this.billingService) {
      return null;
    }

    return await this.billingService.query('availablePrices');
  }

  async getOrganizationBillingParticipant(selector: OrganizationSelector): Promise<OrganizationBilling | null> {
    this.logger.debug('Fetching organization billing (selector=%o)', selector);

    return this.storage.getOrganizationBilling({
      organization: selector.organization,
    });
  }

  getActiveSubscription(input: StripeBillingQueryInput<'activeSubscription'>) {
    if (!this.billingService) {
      throw new Error(`Billing service is not configured!`);
    }

    return this.billingService.query('activeSubscription', input);
  }

  invoices(input: StripeBillingQueryInput<'invoices'>) {
    if (!this.billingService) {
      throw new Error(`Billing service is not configured!`);
    }

    return this.billingService.query('invoices', input);
  }

  upcomingInvoice(input: StripeBillingQueryInput<'upcomingInvoice'>) {
    if (!this.billingService) {
      throw new Error(`Billing service is not configured!`);
    }

    return this.billingService.query('upcomingInvoice', input);
  }

  async downgradeToHobby(input: StripeBillingMutationInput<'cancelSubscriptionForOrganization'>) {
    if (!this.billingService) {
      throw new Error(`Billing service is not configured!`);
    }

    return await this.billingService.mutation('cancelSubscriptionForOrganization', input);
  }
}
