import { addDays, differenceInCalendarDays } from 'date-fns';
import { Inject, Injectable, Scope } from 'graphql-modules';
import {
  EventName,
  SubscriptionCreatedEvent,
  type PaddleBillingApi,
  type TransactionStatus,
} from '@hive/paddle-billing';
import { createTRPCProxyClient, httpLink } from '@trpc/client';
import { BillingInvoiceStatus } from '../../../__generated__/types';
import { Logger } from '../../shared/providers/logger';
import { Storage } from '../../shared/providers/storage';
import { USAGE_DEFAULT_LIMITATIONS } from '../config';
import {
  BillingDataProvider,
  BillingInfo,
  BillingInfoUpdateInput,
  BillingInvoice,
  BillingPrices,
  FuturePayment,
  Subscription,
} from './base-provider';
import { StripeBillingProvider } from './stripe-billing.provider';
import { BILLING_CONFIG, type BillingConfig } from './tokens';

type PaddleSubscriptionCustomData = {
  organizationId?: string;
  hiveSubscription?: boolean;
  migration?: boolean;
};

@Injectable({
  global: true,
  scope: Scope.Singleton,
})
export class PaddleBillingProvider implements BillingDataProvider {
  private logger: Logger;
  private serviceInstance;

  constructor(
    logger: Logger,
    @Inject(BILLING_CONFIG) billingConfig: BillingConfig,
    private storage: Storage,
    private stripe: StripeBillingProvider,
  ) {
    this.logger = logger.child({ source: 'PaddleBillingProvider' });

    this.serviceInstance = billingConfig.paddleServiceEndpoint
      ? createTRPCProxyClient<PaddleBillingApi>({
          links: [httpLink({ url: `${billingConfig.paddleServiceEndpoint}/trpc`, fetch })],
        })
      : null;
  }

  get enabled(): boolean {
    return !!this.serviceInstance;
  }

  async generatePaymentMethodUpdateToken(
    customerId: string,
    organizationId: string,
  ): Promise<string> {
    return await this.service.generateUpdateTransaction
      .mutate({
        customerId,
        organizationId,
      })
      .then(r => r.id);
  }

  async billingInfo(customerId: string, organizationId: string): Promise<BillingInfo> {
    const info = await this.service.customerInfo.query({ customerId, organizationId });

    return {
      billingEmail: info.billingEmail,
      legalName: info.legalName,
      taxId: info.taxId,
      paymentMethod: info.paymentMethod
        ? {
            type: info.paymentMethod.type,
            brand: info.paymentMethod.card?.type ?? null,
            last4: info.paymentMethod.card?.last4 ?? null,
          }
        : null,
    };
  }

  async updateBillingDetails(
    customerId: string,
    organizationId: string,
    details: BillingInfoUpdateInput,
  ) {
    if (details.taxId || details.legalName) {
      await this.service.updateBusiness.mutate({
        customerId,
        organizationId,
        taxId: details.taxId ?? undefined,
        companyName: details.legalName ?? undefined,
      });
    }

    if (details.billingEmail) {
      await this.service.updateBillingContact.mutate({
        customerId,
        organizationId,
        email: details.billingEmail,
      });
    }
  }

  async cancelActiveSubscription(customerId: string, organizationId: string): Promise<void> {
    const activeSubscription = await this.service.activeSubscription.query({
      customerId,
      organizationId,
    });

    if (!activeSubscription) {
      throw new Error('Failed to cancel Paddle subscription, no active subscription found');
    }

    await this.service.cancelSubscription.mutate({
      subscriptionId: activeSubscription.id,
    });
  }

  async handleWebhookEvent(signature: string, eventData: string) {
    const paddleEvent = await this.service.verifyWebhook.query({
      signature,
      rawBody: eventData,
    });

    if (paddleEvent === null) {
      throw new Error('Invalid Paddle webhook event, failed to verify or parse.');
    }

    this.logger.info('Received Paddle webhook event: %o', paddleEvent);

    switch (paddleEvent.eventType) {
      case EventName.SubscriptionCreated: {
        await this.handleSubscriptionCreatedEvent(paddleEvent);
        break;
      }
    }

    this.logger.info(`Paddle webhook event with id "${paddleEvent.eventId}" handled successfully`);
  }

  private async handleSubscriptionCreatedEvent(event: SubscriptionCreatedEvent) {
    const knownPrices = await this.service.availablePrices.query();
    const operationsLimitInMillions = event.data.items.find(
      item => item.price?.id === knownPrices.operationsPrice.id,
    );

    if (!operationsLimitInMillions) {
      this.logger.warn('Received Paddle subscription created event with missing or invalid items');

      throw new Error(
        'Invalid Paddle subscription created event, cant find operations limit in subscription.',
      );
    }

    const customData = event.data.customData as PaddleSubscriptionCustomData;
    if (customData && customData.hiveSubscription && customData.organizationId) {
      const isMigration = customData.migration ?? false;

      this.logger.info(
        'Handling subscription creating event from Paddle, organization=%s, isMigration=%b',
        customData.organizationId,
        isMigration,
      );

      // Step 1: Make sure organization exists and owner details are available
      const [organization] = await Promise.all([
        this.storage.getOrganization({
          organization: customData.organizationId,
        }),
      ]);

      // If migrating from Stripe, no changes are needed in the local records
      if (!isMigration) {
        // Step 2: Update local records with the new subscription
        await this.storage.updateOrganizationPlan({
          billingPlan: 'PRO',
          organization: customData.organizationId,
        });

        // Step 3: Update the limits and retentino for the organization
        await this.storage.updateOrganizationRateLimits({
          organization: customData.organizationId,
          monthlyRateLimit: {
            operations: operationsLimitInMillions.quantity * 1_000_000,
            retentionInDays: USAGE_DEFAULT_LIMITATIONS.PRO.retention,
          },
        });
      }

      let billingRecord = await this.storage.getOrganizationBilling({
        organization: organization.id,
      });

      // Step 4: if we already have a record on Stripe, and we are migrating the org, we can cancel the subscription
      // and delete the record.
      if (billingRecord && billingRecord.provider === 'STRIPE' && isMigration) {
        this.logger.info(
          'Migrating organization from Stripe to Paddle...',
          customData.organizationId,
          isMigration,
        );

        const activeSubscription = await this.stripe.getActiveSubscription(
          billingRecord.externalBillingReference,
        );

        let activatePaddleSubscription = false;
        if (activeSubscription) {
          if (activeSubscription.trialEnd !== null) {
            const trialEnd = new Date(activeSubscription.trialEnd * 1000);
            const daysLeft = differenceInCalendarDays(trialEnd, new Date());
            const endOfTrial = addDays(new Date(), daysLeft);

            // If the trial is still active, we need to set the end of trial to the new subscription
            if (daysLeft > 0) {
              await this.service.setEndOfTrial.mutate({
                customerId: event.data.customerId,
                nextBilledAtTimestamp: endOfTrial.toISOString(),
                organizationId: customData.organizationId,
              });
            } else {
              // Subscription is already active and trial was done, we can safely active the new one and skip trial.
              activatePaddleSubscription = true;
            }
          } else {
            // Subscription is already active and trial was done, we can safely active the new one and skip trial.
            activatePaddleSubscription = true;
          }

          const billingInfo = await this.stripe.billingInfo(billingRecord.externalBillingReference);

          // Cancel and clear the Stripe subscription records.
          await this.stripe.cancelActiveSubscription(billingRecord.externalBillingReference);
          await this.storage.deleteOrganizationBilling({
            organization: organization.id,
          });

          if (billingInfo.billingEmail) {
            this.logger.info(
              `Updating billing contact for organization ${organization.id}, Paddle customer id=${event.data.customerId}`,
            );

            await this.service.updateBillingContact.mutate({
              customerId: event.data.customerId,
              email: billingInfo.billingEmail,
              organizationId: customData.organizationId,
            });
          }

          if (billingInfo.taxId) {
            this.logger.info(
              `Updating tax ID for organization ${organization.id}, Paddle customer id=${event.data.customerId}`,
            );

            await this.service.updateBusiness.mutate({
              customerId: event.data.customerId,
              taxId: billingInfo.taxId ?? undefined,
              companyName: billingInfo.legalName ?? undefined,
              organizationId: customData.organizationId,
            });
          }
        } else {
          this.logger.warn(
            `Failed to cancel Stripe subscription for organization ${organization.id}, will continue with migration.`,
          );
        }

        // In case the older subscription was not in trial,
        // we need to activate the new one immediately and skip the trial period.
        if (activatePaddleSubscription) {
          await this.service.activateSubscription.mutate({
            customerId: event.data.customerId,
            organizationId: customData.organizationId,
          });
        }

        // Set the null, so next piece of code will create a new record with the new customer ID and params.
        billingRecord = null;
      }

      // Step 5: Create billing record with the customer ID
      if (!billingRecord) {
        this.logger.info(
          'Creating a new organizatio billing record...',
          customData.organizationId,
          isMigration,
        );

        await this.storage.createOrganizationBilling({
          externalBillingReference: event.data.customerId,
          organizationId: organization.id,
          billingDayOfMonth: (event.data.currentBillingPeriod?.startsAt
            ? new Date(event.data.currentBillingPeriod.startsAt)
            : new Date()
          ).getDate(),
          provider: 'PADDLE',
        });
      }
    } else {
      this.logger.warn(
        'Received Paddle subscription created event with missing or invalid custom data',
      );

      throw new Error(
        'Invalid Paddle subscription created event, cant find custom data in subscription.',
      );
    }
  }

  async syncOperationsLimit(
    customerId: string,
    organizationId: string,
    operationsInMillions: number,
  ): Promise<void> {
    return await this.service.syncOrganizationToProvider.mutate({
      customerId,
      organizationId,
      reserved: {
        operations: operationsInMillions,
      },
    });
  }

  private get service() {
    if (!this.serviceInstance) {
      throw new Error('Paddle service is not configured');
    }

    return this.serviceInstance;
  }

  async subscriptionManagementUrl(
    customerId: string,
    organizationId: string,
  ): Promise<string | null> {
    const activeSubscription = await this.service.activeSubscription.query({
      customerId,
      organizationId,
    });

    if (!activeSubscription) {
      return null;
    }

    const url = activeSubscription.managementUrls?.updatePaymentMethod;

    if (!url) {
      throw new Error('Failed to get subscription management URL for Paddle subsciption');
    }

    return url;
  }

  async hasPaymentIssues(customerId: string, organizationId: string): Promise<boolean> {
    const activeSubscription = await this.service.activeSubscription.query({
      customerId,
      organizationId,
    });

    if (activeSubscription) {
      return activeSubscription.status === 'past_due' || activeSubscription.status === 'paused';
    }

    return false;
  }

  async getAvailablePrices(): Promise<BillingPrices> {
    const prices = await this.service.availablePrices.query();

    return {
      basePrice: {
        identifier: prices.basePrice.id,
        amount: parseInt(prices.basePrice.unitPrice.amount),
      },
      pricePerMillionOperations: {
        identifier: prices.operationsPrice.id,
        amount: parseInt(prices.operationsPrice.unitPrice.amount),
      },
    };
  }

  async getActiveSubscription(
    customerId: string,
    organizationId: string,
  ): Promise<Subscription | null> {
    const activeSubscriptionResult = await this.service.activeSubscription.query({
      customerId,
      organizationId,
    });

    if (!activeSubscriptionResult) {
      return null;
    }

    return {
      id: activeSubscriptionResult.id,
      trialEnd:
        activeSubscriptionResult.status === 'trialing' && activeSubscriptionResult.nextBilledAt
          ? parseInt(activeSubscriptionResult.nextBilledAt)
          : null,
    };
  }

  async invoices(customerId: string, organizationId: string): Promise<BillingInvoice[]> {
    const invoices = await this.service.invoices.query({ customerId, organizationId });

    return invoices.map(invoice => ({
      id: invoice.id,
      date: new Date(invoice.createdAt),
      periodStart: new Date(invoice.billingPeriod!.startsAt),
      periodEnd: new Date(invoice.billingPeriod!.endsAt),
      amount: invoice.details?.totals?.total ? parseFloat(invoice.details.totals.total) : 0,
      status: this.mapInvoiceStatus(invoice.status),
      pdfUrl: invoice.pdfLink,
    }));
  }

  private mapInvoiceStatus(transactionStatus: TransactionStatus): BillingInvoiceStatus {
    switch (transactionStatus) {
      case 'paid':
      case 'billed':
      case 'completed':
        return 'PAID';
      case 'canceled':
        return 'VOID';
      case 'draft':
        return 'DRAFT';
      case 'past_due':
        return 'UNCOLLECTIBLE';
      case 'ready':
        return 'OPEN';
    }
  }

  async upcomingPayment(customerId: string, organizationId: string): Promise<FuturePayment | null> {
    const nextTransaction = await this.service.upcomingPayment.query({
      customerId,
      organizationId,
    });

    if (!nextTransaction?.nextBilledAt) {
      return null;
    }

    return {
      amount: 1, // TODO
      date: new Date(nextTransaction.nextBilledAt),
    };
  }
}
