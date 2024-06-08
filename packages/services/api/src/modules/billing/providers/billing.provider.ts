import { Injectable, Scope } from 'graphql-modules';
import { OrganizationSelector } from '../../../__generated__/types';
import { OrganizationBilling } from '../../../shared/entities';
import { Logger } from '../../shared/providers/logger';
import { Storage } from '../../shared/providers/storage';
import {
  BillingInfo,
  BillingInfoUpdateInput,
  BillingInvoice,
  FuturePayment,
  Subscription,
  type BillingPrices,
} from './base-provider';
import { PaddleBillingProvider } from './paddle-billing.provider';
import { StripeBillingProvider } from './stripe-billing.provider';

@Injectable({
  global: true,
  scope: Scope.Singleton,
})
export class BillingProvider {
  private logger: Logger;

  constructor(
    logger: Logger,
    private storage: Storage,
    private paddle: PaddleBillingProvider,
    private stripe: StripeBillingProvider,
  ) {
    this.logger = logger.child({ source: 'BillingProvider' });
  }

  get enabled() {
    return this.paddle.enabled;
  }

  getAvailablePrices(): Promise<BillingPrices> {
    this.logger.debug('Fetching available prices from default provider');

    return this.paddle.getAvailablePrices();
  }

  async getOrganizationBillingParticipant(
    selector: OrganizationSelector,
  ): Promise<OrganizationBilling | null> {
    this.logger.debug('Fetching organization billing record (selector=%o)', selector);

    return this.storage.getOrganizationBilling({
      organization: selector.organization,
    });
  }

  async generatePaymentMethodUpdateToken(billingRecord: OrganizationBilling) {
    if (billingRecord.provider === 'PADDLE') {
      return await this.paddle.generatePaymentMethodUpdateToken(
        billingRecord.externalBillingReference,
        billingRecord.organizationId,
      );
    }

    throw new Error('Unsupported billing provider');
  }

  async downgradeToHobby(billingRecord: OrganizationBilling) {
    this.logger.debug('Downgrading to Hobby (billingRecord=%o)', billingRecord);

    if (billingRecord.provider === 'PADDLE') {
      return await this.paddle.cancelActiveSubscription(
        billingRecord.externalBillingReference,
        billingRecord.organizationId,
      );
    }

    if (billingRecord.provider === 'STRIPE') {
      return await this.stripe.cancelActiveSubscription(billingRecord.externalBillingReference);
    }

    throw new Error('Unsupported billing provider, failed to downgrade.');
  }

  async syncOrganization(billingRecord: OrganizationBilling, operationsLimitInMillions: number) {
    this.logger.debug(
      `Billing sync organization (orgId="${billingRecord.organizationId}"), new limit: ${operationsLimitInMillions} millions`,
    );

    if (billingRecord.provider === 'PADDLE') {
      return await this.paddle.syncOperationsLimit(
        billingRecord.externalBillingReference,
        billingRecord.organizationId,
        operationsLimitInMillions,
      );
    }

    if (billingRecord.provider === 'STRIPE') {
      return await this.stripe.syncOperationsLimit(
        billingRecord.externalBillingReference,
        billingRecord.organizationId,
        operationsLimitInMillions,
      );
    }
  }

  async getActiveSubscription(billingRecord: OrganizationBilling): Promise<Subscription | null> {
    if (billingRecord.provider === 'PADDLE') {
      return this.paddle.getActiveSubscription(
        billingRecord.externalBillingReference,
        billingRecord.organizationId,
      );
    }

    if (billingRecord.provider === 'STRIPE') {
      return this.stripe.getActiveSubscription(billingRecord.externalBillingReference);
    }

    return null;
  }

  async updateBillingDetails(billingRecord: OrganizationBilling, input: BillingInfoUpdateInput) {
    if (billingRecord.provider === 'PADDLE') {
      return await this.paddle.updateBillingDetails(
        billingRecord.externalBillingReference,
        billingRecord.organizationId,
        input,
      );
    }

    throw new Error('Unsupported billing provider');
  }

  async billingInfo(billingRecord: OrganizationBilling): Promise<
    BillingInfo & {
      renewalDay: number | null;
    }
  > {
    if (billingRecord.provider === 'PADDLE') {
      return {
        renewalDay: billingRecord.billingDayOfMonth || null,
        ...(await this.paddle.billingInfo(
          billingRecord.externalBillingReference,
          billingRecord.organizationId,
        )),
      };
    }

    if (billingRecord.provider === 'STRIPE') {
      return {
        ...(await this.stripe.billingInfo(billingRecord.externalBillingReference)),
        renewalDay: 1,
      };
    }

    return {
      taxId: null,
      legalName: null,
      billingEmail: null,
      renewalDay: null,
      paymentMethod: null,
    };
  }

  async hasPaymentIssues(billingRecord: OrganizationBilling): Promise<boolean> {
    if (billingRecord.provider === 'PADDLE') {
      return this.paddle.hasPaymentIssues(
        billingRecord.externalBillingReference,
        billingRecord.organizationId,
      );
    }

    if (billingRecord.provider === 'STRIPE') {
      return this.stripe.hasPaymentIssues(billingRecord.externalBillingReference);
    }

    return false;
  }

  async invoices(billingRecord: OrganizationBilling): Promise<BillingInvoice[]> {
    if (billingRecord.provider === 'PADDLE') {
      return this.paddle.invoices(
        billingRecord.externalBillingReference,
        billingRecord.organizationId,
      );
    }

    if (billingRecord.provider === 'STRIPE') {
      return this.stripe.invoices(billingRecord.externalBillingReference);
    }

    return [];
  }

  async upcomingPayment(billingRecord: OrganizationBilling): Promise<FuturePayment | null> {
    if (billingRecord.provider === 'PADDLE') {
      return this.paddle.upcomingPayment(
        billingRecord.externalBillingReference,
        billingRecord.organizationId,
      );
    }

    if (billingRecord.provider === 'STRIPE') {
      return this.stripe.upcomingPayment(billingRecord.externalBillingReference);
    }

    return null;
  }

  async subscriptionManagementUrl(billingRecord: OrganizationBilling): Promise<string | null> {
    if (billingRecord.provider === 'PADDLE') {
      return this.paddle.subscriptionManagementUrl(
        billingRecord.externalBillingReference,
        billingRecord.organizationId,
      );
    }

    if (billingRecord.provider === 'STRIPE') {
      return this.stripe.subscriptionManagementUrl(billingRecord.externalBillingReference);
    }

    throw new Error('Unsupported billing provider');
  }
}
