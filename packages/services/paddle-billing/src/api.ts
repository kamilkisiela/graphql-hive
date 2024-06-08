import { z } from 'zod';
import { FastifyRequest, handleTRPCError } from '@hive/service-common';
import { Paddle, Price, Subscription } from '@paddle/paddle-node-sdk';
import type { inferRouterInputs } from '@trpc/server';
import { initTRPC } from '@trpc/server';

export type Context = {
  paddleData$: Promise<{
    operationsPrice: Price;
    basePrice: Price;
  }>;
  paddle: Paddle;
  req: FastifyRequest;
  paddleConfig: {
    webhookSecret: string;
  };
};

const t = initTRPC.context<Context>().create();
const procedure = t.procedure.use(handleTRPCError);

export {
  type TransactionStatus,
  EventName,
  SubscriptionCreatedEvent,
} from '@paddle/paddle-node-sdk';

function isActiveSubscription(subscription: Subscription | null): boolean {
  if (!subscription) {
    return false;
  }

  return (
    subscription.status === 'active' ||
    subscription.status === 'trialing' ||
    subscription.status === 'past_due'
  );
}

async function getActiveSubscription(
  paddle: Paddle,
  customerId: string,
  organizationId: string,
): Promise<Subscription | null> {
  const subscriptions = await paddle.subscriptions
    .list({
      customerId: [customerId],
      status: ['active', 'trialing', 'past_due'],
    })
    .next()
    .then(v =>
      v.filter(
        r =>
          r.customData &&
          'hiveSubscription' in r.customData &&
          'organizationId' in r.customData &&
          r.customData.organizationId === organizationId,
      ),
    );

  return subscriptions[0] ?? null;
}

export const paddleBillingApiRouter = t.router({
  verifyWebhook: procedure
    .input(
      z.object({
        signature: z.string().min(1),
        rawBody: z.string().min(1),
      }),
    )
    .query(async ({ ctx, input }) => {
      const eventData = ctx.paddle.webhooks.unmarshal(
        input.rawBody,
        ctx.paddleConfig.webhookSecret,
        input.signature,
      );

      return eventData;
    }),
  availablePrices: procedure.query(async ({ ctx }) => {
    return await ctx.paddleData$;
  }),
  invoices: procedure
    .input(
      z.object({
        customerId: z.string().min(1),
        organizationId: z.string().min(1),
      }),
    )
    .query(async ({ ctx, input }) => {
      const activeSubscription = await getActiveSubscription(
        ctx.paddle,
        input.customerId,
        input.organizationId,
      );

      if (!activeSubscription) {
        return [];
      }

      const transactions = await ctx.paddle.transactions
        .list({
          customerId: [input.customerId],
          perPage: 100,
        })
        .next();

      const invoices = transactions.filter(r => r.invoiceId);

      return await Promise.all(
        invoices.map(async invoice => {
          return {
            ...invoice,
            pdfLink: await ctx.paddle.transactions.getInvoicePDF(invoice.id).then(r => r.url),
          };
        }),
      );
    }),
  upcomingPayment: procedure
    .input(
      z.object({
        customerId: z.string().min(1),
        organizationId: z.string().min(1),
      }),
    )
    .query(async ({ ctx, input }) => {
      const activeSubscription = await getActiveSubscription(
        ctx.paddle,
        input.customerId,
        input.organizationId,
      );

      if (!activeSubscription) {
        return null;
      }

      console.log('activeSubscription', JSON.stringify(activeSubscription, null, 2));

      return {
        nextBilledAt: activeSubscription.nextBilledAt,
      };
    }),
  customerInfo: procedure
    .input(
      z.object({
        customerId: z.string().min(1),
        organizationId: z.string().min(1),
      }),
    )
    .query(async ({ ctx, input }) => {
      const activeSubscription = await getActiveSubscription(
        ctx.paddle,
        input.customerId,
        input.organizationId,
      );
      const customer = await ctx.paddle.customers.get(input.customerId);

      if (!activeSubscription || !customer || !activeSubscription.businessId) {
        return {
          taxId: null,
          legalName: null,
          billingEmail: null,
          paymentMethod: null,
        };
      }

      const business = await ctx.paddle.businesses.get(customer.id, activeSubscription.businessId);
      const recentTransaction = await ctx.paddle.transactions
        .list({
          status: ['completed'],
          subscriptionId: [activeSubscription.id],
          perPage: 1,
        })
        .next()
        .then(r => r[0]);
      const paymentMethod = recentTransaction?.payments[0]?.methodDetails ?? null;
      const billingContact = business.contacts?.[0]?.email;

      return {
        taxId: business.taxIdentifier,
        legalName: business.name,
        billingEmail: billingContact ?? null,
        paymentMethod,
      };
    }),
  activeSubscription: procedure
    .input(
      z.object({
        customerId: z.string().nonempty(),
        organizationId: z.string().nonempty(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return await getActiveSubscription(ctx.paddle, input.customerId, input.organizationId);
    }),
  updateBillingContact: procedure
    .input(
      z.object({
        customerId: z.string().min(1),
        organizationId: z.string().min(1),
        email: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const actualSubscription = await getActiveSubscription(
        ctx.paddle,
        input.customerId,
        input.organizationId,
      );

      if (!actualSubscription?.businessId) {
        throw new Error(
          'Failed to update tax ID: no active subscription found, or business is not linked',
        );
      }

      if (input.email) {
        const business = await ctx.paddle.businesses.get(
          input.customerId,
          actualSubscription.businessId,
        );

        await ctx.paddle.businesses.update(input.customerId, business.id, {
          contacts: [
            {
              email: input.email,
            },
          ],
        });
      }
    }),
  generateUpdateTransaction: procedure
    .input(
      z.object({
        customerId: z.string().min(1),
        organizationId: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const activeSubscription = await getActiveSubscription(
        ctx.paddle,
        input.customerId,
        input.organizationId,
      );

      if (!activeSubscription) {
        throw new Error('Failed to generate payment method update token: no active subscription');
      }

      return await ctx.paddle.subscriptions.getPaymentMethodChangeTransaction(
        activeSubscription.id,
      );
    }),
  updateBusiness: procedure
    .input(
      z.object({
        customerId: z.string().min(1),
        organizationId: z.string().min(1),
        taxId: z.string().optional(),
        companyName: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const actualSubscription = await getActiveSubscription(
        ctx.paddle,
        input.customerId,
        input.organizationId,
      );

      if (!actualSubscription?.businessId) {
        throw new Error(
          'Failed to update tax ID: no active subscription found, or business is not linked',
        );
      }

      return await ctx.paddle.businesses.update(input.customerId, actualSubscription.businessId, {
        taxIdentifier: input.taxId,
        companyNumber: input.taxId,
        name: input.companyName,
      });
    }),
  setEndOfTrial: procedure
    .input(
      z.object({
        customerId: z.string().min(1),
        organizationId: z.string().min(1),
        nextBilledAtTimestamp: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const actualSubscription = await getActiveSubscription(
        ctx.paddle,
        input.customerId,
        input.organizationId,
      );

      if (!actualSubscription) {
        throw new Error('Failed to update billing cycle: no active subscription found');
      }

      return await ctx.paddle.subscriptions.update(actualSubscription.id, {
        nextBilledAt: input.nextBilledAtTimestamp,
        prorationBillingMode: 'do_not_bill',
      });
    }),
  activateSubscription: procedure
    .input(
      z.object({
        customerId: z.string().min(1),
        organizationId: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const actualSubscription = await getActiveSubscription(
        ctx.paddle,
        input.customerId,
        input.organizationId,
      );

      if (!actualSubscription) {
        throw new Error('Failed to activate subscription: no active subscription found');
      }

      return await ctx.paddle.subscriptions.activate(actualSubscription.id);
    }),
  syncOrganizationToProvider: procedure
    .input(
      z.object({
        customerId: z.string().min(1),
        organizationId: z.string().min(1),
        reserved: z
          .object({
            /** in millions, value 1 is actually 1_000_000 */
            operations: z.number().nonnegative(),
          })
          .required(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const actualSubscription = await getActiveSubscription(
        ctx.paddle,
        input.customerId,
        input.organizationId,
      );
      const paddlePrices = await ctx.paddleData$;

      if (actualSubscription) {
        for (const item of actualSubscription.items) {
          if (item.price?.id === paddlePrices.operationsPrice.id) {
            await ctx.paddle.subscriptions.update(actualSubscription.id, {
              prorationBillingMode:
                actualSubscription.status === 'trialing' ? 'do_not_bill' : 'prorated_immediately',
              items: [
                {
                  priceId: paddlePrices.basePrice.id,
                  quantity: 1,
                },
                {
                  priceId: paddlePrices.operationsPrice.id,
                  quantity: input.reserved.operations,
                },
              ],
            });
          }
        }
      }
    }),
  cancelSubscription: procedure
    .input(
      z.object({
        subscriptionId: z.string().nonempty(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const subscription = await ctx.paddle.subscriptions.get(input.subscriptionId);

      if (!subscription) {
        throw new Error(`Failed to cancel subscription for organization: subscription not found`);
      }

      if (isActiveSubscription(subscription)) {
        return await ctx.paddle.subscriptions.cancel(subscription.id, {
          effectiveFrom: 'immediately',
        });
      }

      throw new Error(
        `Failed to cancel subscription for organization: subscription is in invalid state: ${subscription.status}`,
      );
    }),
});

export type PaddleBillingApi = typeof paddleBillingApiRouter;
export type PaddleBillingApiInput = inferRouterInputs<PaddleBillingApi>;
