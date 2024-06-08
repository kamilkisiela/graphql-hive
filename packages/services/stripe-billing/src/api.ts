import { addDays, startOfMonth } from 'date-fns';
import { Stripe } from 'stripe';
import { z } from 'zod';
import { FastifyRequest, handleTRPCError } from '@hive/service-common';
import { createStorage } from '@hive/storage';
import type { inferRouterInputs } from '@trpc/server';
import { initTRPC } from '@trpc/server';

export type Context = {
  storage$: ReturnType<typeof createStorage>;
  stripe: Stripe;
  stripeData$: Promise<{
    operationsPrice: Stripe.Price;
    basePrice: Stripe.Price;
  }>;
  req: FastifyRequest;
};

export { Stripe as StripeTypes };

const t = initTRPC.context<Context>().create();
const procedure = t.procedure.use(handleTRPCError);

export const stripeBillingApiRouter = t.router({
  availablePrices: procedure.query(async ({ ctx }) => {
    return await ctx.stripeData$;
  }),
  invoices: procedure
    .input(
      z.object({
        customerId: z.string().nonempty(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const invoices = await ctx.stripe.invoices.list({
        customer: input.customerId,
        expand: ['data.charge'],
      });

      return invoices.data;
    }),
  customerInfo: procedure
    .input(
      z.object({
        customerId: z.string().nonempty(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const customer = await ctx.stripe.customers.retrieve(input.customerId);

      if (customer.deleted) {
        return null;
      }

      return customer;
    }),
  upcomingInvoice: procedure
    .input(
      z.object({
        customerId: z.string().nonempty(),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        const upcomingInvoice = await ctx.stripe.invoices.retrieveUpcoming({
          customer: input.customerId,
        });

        return upcomingInvoice;
      } catch (e) {
        return null;
      }
    }),
  activeSubscription: procedure
    .input(
      z.object({
        customerId: z.string().nonempty(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const customer = await ctx.stripe.customers.retrieve(input.customerId);
      const subscriptions = await ctx.stripe.subscriptions
        .list({
          customer: input.customerId,
        })
        .then(v => v.data.filter(r => r.metadata?.hive_subscription));

      const actualSubscription = subscriptions[0] || null;

      const paymentMethod = await ctx.stripe.paymentMethods.list({
        customer: customer.id,
        type: 'card',
      });

      return {
        paymentMethod: paymentMethod.data[0] || null,
        subscription: actualSubscription,
      };
    }),
  syncOrganizationToStripe: procedure
    .input(
      z.object({
        customerId: z.string().nonempty(),
        reserved: z
          .object({
            /** in millions, value 1 is actually 1_000_000 */
            operations: z.number().nonnegative(),
          })
          .required(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const stripePrices = await ctx.stripeData$;
      const allSubscriptions = await ctx.stripe.subscriptions.list({
        customer: input.customerId,
      });

      const actualSubscription = allSubscriptions.data.find(r => r.metadata?.hive_subscription);

      if (actualSubscription) {
        for (const item of actualSubscription.items.data) {
          if (item.plan.id === stripePrices.operationsPrice.id) {
            await ctx.stripe.subscriptionItems.update(item.id, {
              quantity: input.reserved.operations,
            });
          }
        }
      }

      const updateParams: Stripe.CustomerUpdateParams = {};

      if (Object.keys(updateParams).length > 0) {
        await ctx.stripe.customers.update(input.customerId, updateParams);
      }
    }),
  generateStripePortalLink: procedure
    .input(
      z.object({
        customerId: z.string().nonempty(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.stripe.billingPortal.sessions.create({
        customer: input.customerId,
        return_url: 'https://app.graphql-hive.com/',
      });

      return session.url;
    }),
  cancelSubscriptionForOrganization: procedure
    .input(
      z.object({
        customerId: z.string().nonempty(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const subscriptions = await ctx.stripe.subscriptions
        .list({
          customer: input.customerId,
        })
        .then(v => v.data.filter(r => r.metadata?.hive_subscription));

      if (subscriptions.length === 0) {
        throw new Error(
          `Failed to cancel subscription for organization: failed to find linked Stripe subscriptions`,
        );
      }

      const actualSubscription = subscriptions[0];
      const response = await ctx.stripe.subscriptions.cancel(actualSubscription.id, {
        prorate: true,
        invoice_now: true,
      });

      return response;
    }),
  createSubscriptionForOrganization: procedure
    .input(
      z.object({
        paymentMethodId: z.string().nullish(),
        organizationId: z.string().nonempty(),
        couponCode: z.string().nullish(),
        reserved: z
          .object({
            /** in millions, value 1 is actually 1_000_000 */
            operations: z.number().nonnegative(),
          })
          .required(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
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
            .then(r => r.id);

      if (!organizationBillingRecord) {
        organizationBillingRecord = await storage.createOrganizationBilling({
          externalBillingReference: customerId,
          organizationId: input.organizationId,
          provider: 'STRIPE',
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
          v => v.id === input.paymentMethodId,
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
          `Payment method is not specified, and customer does not have it configured.`,
        );
      }

      const stripePrices = await ctx.stripeData$;

      const subscription = await ctx.stripe.subscriptions.create({
        metadata: {
          hive_subscription: 'true',
        },
        coupon: input.couponCode || undefined,
        customer: customerId,
        default_payment_method: paymentMethodId,
        trial_end: Math.floor(addDays(new Date(), 30).getTime() / 1000),
        backdate_start_date: Math.floor(startOfMonth(new Date()).getTime() / 1000),
        items: [
          {
            price: stripePrices.basePrice.id,
            quantity: 1,
          },
          {
            price: stripePrices.operationsPrice.id,
            quantity: input.reserved.operations,
          },
        ],
      });

      return {
        organizationBilling: organizationBillingRecord,
        stripeCustomer: customerId,
        stripeSubscription: subscription,
      };
    }),
});

export type StripeBillingApi = typeof stripeBillingApiRouter;

export type StripeBillingApiInput = inferRouterInputs<StripeBillingApi>;
