import * as trpc from '@trpc/server';
import { z } from 'zod';
import { inferProcedureInput, inferProcedureOutput } from '@trpc/server';
import { createStorage } from '@hive/storage';
import { Stripe } from 'stripe';
import { addMonths, startOfMonth } from 'date-fns';

export type Context = {
  storage$: ReturnType<typeof createStorage>;
  stripe: Stripe;
  stripeData$: Promise<{
    schemaPushesPrice: Stripe.Price;
    operationsPrice: Stripe.Price;
    basePrice: Stripe.Price;
  }>;
};

export { Stripe as StripeTypes };

export const stripeBillingApiRouter = trpc
  .router<Context>()
  .query('availablePrices', {
    async resolve({ ctx }) {
      return await ctx.stripeData$;
    },
  })
  .query('invoices', {
    input: z.object({
      organizationId: z.string().nonempty(),
    }),
    async resolve({ ctx, input }) {
      const storage = await ctx.storage$;
      const organizationBillingRecord = await storage.getOrganizationBilling({
        organization: input.organizationId,
      });

      if (!organizationBillingRecord) {
        throw new Error(`Organization does not have a subscription record!`);
      }

      const invoices = await ctx.stripe.invoices.list({
        customer: organizationBillingRecord.externalBillingReference,
      });

      return invoices.data;
    },
  })
  .query('upcomingInvoice', {
    input: z.object({
      organizationId: z.string().nonempty(),
    }),
    async resolve({ ctx, input }) {
      const storage = await ctx.storage$;
      const organizationBillingRecord = await storage.getOrganizationBilling({
        organization: input.organizationId,
      });

      if (!organizationBillingRecord) {
        throw new Error(`Organization does not have a subscription record!`);
      }

      try {
        const upcomingInvoice = await ctx.stripe.invoices.retrieveUpcoming({
          customer: organizationBillingRecord.externalBillingReference,
        });

        return upcomingInvoice;
      } catch (e) {
        return null;
      }
    },
  })
  .query('activeSubscription', {
    input: z.object({
      organizationId: z.string().nonempty(),
    }),
    async resolve({ ctx, input }) {
      const storage = await ctx.storage$;
      const organizationBillingRecord = await storage.getOrganizationBilling({
        organization: input.organizationId,
      });

      if (!organizationBillingRecord) {
        throw new Error(`Organization does not have a subscription record!`);
      }

      const customer = await ctx.stripe.customers.retrieve(
        organizationBillingRecord.externalBillingReference
      );

      if (customer.deleted === true) {
        await storage.deleteOrganizationBilling({
          organization: input.organizationId,
        });

        return null;
      }

      const subscriptions = await ctx.stripe.subscriptions
        .list({
          customer: organizationBillingRecord.externalBillingReference,
        })
        .then((v) => v.data.filter((r) => r.metadata?.hive_subscription));

      const actualSubscription = subscriptions[0] || null;

      const paymentMethod = await ctx.stripe.paymentMethods.list({
        customer: customer.id,
        type: 'card',
      });

      return {
        paymentMethod: paymentMethod.data[0] || null,
        subscription: actualSubscription,
      };
    },
  })
  .mutation('syncOrganizationToStripe', {
    input: z.object({
      organizationId: z.string().nonempty(),
      reserved: z
        .object({
          /** in millions, value 1 is actually 1_000_000 */
          operations: z.number().nonnegative(),
          schemaPushes: z.number().nonnegative(),
        })
        .required(),
    }),
    async resolve({ ctx, input }) {
      const storage = await ctx.storage$;
      const [organizationBillingRecord, organization, stripePrices] =
        await Promise.all([
          storage.getOrganizationBilling({
            organization: input.organizationId,
          }),
          storage.getOrganization({
            organization: input.organizationId,
          }),
          ctx.stripeData$,
        ]);

      if (organizationBillingRecord && organization) {
        const allSubscriptions = await ctx.stripe.subscriptions.list({
          customer: organizationBillingRecord.externalBillingReference,
        });

        const actualSubscription = allSubscriptions.data.find(
          (r) => r.metadata?.hive_subscription
        );

        if (actualSubscription) {
          for (const item of actualSubscription.items.data) {
            if (item.plan.id === stripePrices.operationsPrice.id) {
              await ctx.stripe.subscriptionItems.update(item.id, {
                quantity: input.reserved.operations,
              });
            }
            if (item.plan.id === stripePrices.schemaPushesPrice.id) {
              await ctx.stripe.subscriptionItems.update(item.id, {
                quantity: input.reserved.schemaPushes,
              });
            }
          }
        }

        const updateParams: Stripe.CustomerUpdateParams = {};

        if (organizationBillingRecord.billingEmailAddress) {
          updateParams.email = organizationBillingRecord.billingEmailAddress;
        }

        if (Object.keys(updateParams).length > 0) {
          await ctx.stripe.customers.update(
            organizationBillingRecord.externalBillingReference,
            updateParams
          );
        }
      } else {
        throw new Error(
          `Failed to sync subscription for organization: failed to find find active record`
        );
      }
    },
  })
  .mutation('cancelSubscriptionForOrganization', {
    input: z.object({
      organizationId: z.string().nonempty(),
    }),
    async resolve({ ctx, input }) {
      const storage = await ctx.storage$;
      const organizationBillingRecord = await storage.getOrganizationBilling({
        organization: input.organizationId,
      });

      if (organizationBillingRecord === null) {
        throw new Error(
          `Failed to cancel subscription for organization: no existing participant record`
        );
      }

      const subscriptions = await ctx.stripe.subscriptions
        .list({
          customer: organizationBillingRecord.externalBillingReference,
        })
        .then((v) => v.data.filter((r) => r.metadata?.hive_subscription));

      if (subscriptions.length === 0) {
        throw new Error(
          `Failed to cancel subscription for organization: failed to find linked Stripe subscriptions`
        );
      }

      const actualSubscription = subscriptions[0];
      const response = await ctx.stripe.subscriptions.del(
        actualSubscription.id,
        {
          prorate: true,
        }
      );

      return response;
    },
  })
  .mutation('createSubscriptionForOrganization', {
    input: z.object({
      paymentMethodId: z.string().nullish(),
      organizationId: z.string().nonempty(),
      couponCode: z.string().nullish(),
      reserved: z
        .object({
          /** in millions, value 1 is actually 1_000_000 */
          operations: z.number().nonnegative(),
          schemaPushes: z.number().nonnegative(),
        })
        .required(),
    }),
    async resolve({ ctx, input }) {
      const storage = await ctx.storage$;
      let organizationBillingRecord = await storage.getOrganizationBilling({
        organization: input.organizationId,
      });
      const organization = await storage.getOrganization({
        organization: input.organizationId,
      });

      const orgOwner = await storage.getOrganizationOwner({
        organization: input.organizationId,
      });

      const customerId = organizationBillingRecord?.externalBillingReference
        ? organizationBillingRecord.externalBillingReference
        : await ctx.stripe.customers
            .create({
              metadata: {
                external_reference_id: input.organizationId,
              },
              email: orgOwner.user.email,
              name: organization.name,
            })
            .then((r) => r.id);

      if (!organizationBillingRecord) {
        organizationBillingRecord = await storage.createOrganizationBilling({
          externalBillingReference: customerId,
          organizationId: input.organizationId,
          billingEmailAddress: orgOwner.user.email,
        });
      }

      const existingPaymentMethods = (
        await ctx.stripe.paymentMethods.list({
          customer: customerId,
          type: 'card',
        })
      ).data;

      let paymentMethodId: string | null = null;

      if (input.paymentMethodId) {
        const paymentMethodConfiguredAlready = existingPaymentMethods.find(
          (v) => v.id === input.paymentMethodId
        );

        if (paymentMethodConfiguredAlready) {
          paymentMethodId = paymentMethodConfiguredAlready.id;
        } else {
          paymentMethodId = (
            await ctx.stripe.paymentMethods.attach(input.paymentMethodId, {
              customer: customerId,
            })
          ).id;
        }
      } else {
        paymentMethodId = existingPaymentMethods[0]?.id || null;
      }

      if (!paymentMethodId) {
        throw new Error(
          `Payment method is not specified, and customer does not have it configured.`
        );
      }

      const stripePrices = await ctx.stripeData$;

      const subscription = await ctx.stripe.subscriptions.create({
        trial_period_days: 14,
        metadata: {
          hive_subscription: 'true',
        },
        coupon: input.couponCode || undefined,
        customer: customerId,
        default_payment_method: paymentMethodId,
        billing_cycle_anchor:
          startOfMonth(addMonths(new Date(), 1)).getTime() / 1000,
        items: [
          {
            price: stripePrices.basePrice.id,
            quantity: 1,
          },
          {
            price: stripePrices.operationsPrice.id,
            quantity: input.reserved.operations,
          },
          {
            price: stripePrices.schemaPushesPrice.id,
            quantity: input.reserved.schemaPushes,
          },
        ],
      });

      return {
        organizationBilling: organizationBillingRecord,
        stripeCustomer: customerId,
        stripeSubscription: subscription,
      };
    },
  });

export type StripeBillingApi = typeof stripeBillingApiRouter;

export type StripeBillingApiQuery = keyof StripeBillingApi['_def']['queries'];
export type StripeBillingQueryOutput<TRouteKey extends StripeBillingApiQuery> =
  inferProcedureOutput<StripeBillingApi['_def']['queries'][TRouteKey]>;
export type StripeBillingQueryInput<TRouteKey extends StripeBillingApiQuery> =
  inferProcedureInput<StripeBillingApi['_def']['queries'][TRouteKey]>;

export type StripeBillingApiMutation =
  keyof StripeBillingApi['_def']['mutations'];
export type StripeBillingMutationOutput<
  TRouteKey extends StripeBillingApiMutation
> = inferProcedureOutput<StripeBillingApi['_def']['mutations'][TRouteKey]>;
export type StripeBillingMutationInput<
  TRouteKey extends StripeBillingApiMutation
> = inferProcedureInput<StripeBillingApi['_def']['mutations'][TRouteKey]>;
