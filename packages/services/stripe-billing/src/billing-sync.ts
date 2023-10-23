import { Stripe } from 'stripe';
import { FastifyLoggerInstance } from '@hive/service-common';
import { createStorage as createPostgreSQLStorage } from '@hive/storage';

export function createStripeBilling(config: {
  logger: FastifyLoggerInstance;
  rateEstimator: {
    endpoint: string;
  };
  storage: {
    connectionString: string;
  };
  stripe: {
    token: string;
    syncIntervalMs: number;
  };
}) {
  const logger = config.logger;
  const postgres$ = createPostgreSQLStorage(config.storage.connectionString, 10);
  let intervalHandle: null | ReturnType<typeof setInterval> = null;
  // feat(metered-usage)
  // const estimationApi = createTRPCClient<UsageEstimatorApi>({
  //   url: `${config.rateEstimator.endpoint}/trpc`,
  //   fetch,
  // });
  const stripeApi = new Stripe(config.stripe.token, {
    apiVersion: '2023-10-16',
    typescript: true,
  });
  const loadStripeData$ = ensureStripeProducts();

  async function ensureStripeProducts(): Promise<{
    operationsPrice: Stripe.Price;
    basePrice: Stripe.Price;
  }> {
    const relevantProducts = await stripeApi.products
      .list({
        active: true,
        type: 'service',
      })
      .then(r => r.data.filter(v => v.metadata?.hive_plan && v.active === true));

    if (relevantProducts.length !== 1) {
      throw new Error(
        `Invalid count of Hive products configured in Stripe: ${relevantProducts.length}`,
      );
    }

    const prices = (await stripeApi.prices.list({
      product: relevantProducts[0].id,
      active: true,
      expand: ['data.tiers'],
    })) as Stripe.Response<Stripe.ApiList<Stripe.Price & { tiers: Stripe.Price.Tier[] }>>;

    const operationsPrice = prices.data.find(v => v.metadata?.hive_usage === 'operations');

    if (!operationsPrice) {
      throw new Error(`Failed to find Stripe price ID with Hive metadata for operations`);
    }

    const basePrice = prices.data.find(v => v.metadata?.hive_usage === 'base');

    if (!basePrice) {
      throw new Error(`Failed to find Stripe price ID with Hive metadata for base price`);
    }

    return {
      operationsPrice,
      basePrice,
    };
  }

  // feat(metered-usage)
  // This is needed only if we want to enable real-time usage-based billing, and not by reserved quota.
  // async function estimateAndReport() {
  //   const stripePrices = await loadStripeData$;
  //   const now = new Date();
  //   const window = {
  //     startTime: startOfMonth(now).toUTCString(),
  //     endTime: endOfMonth(now).toUTCString(),
  //   };
  //   config.logger.info(
  //     `Calculating billing usage information based on window: ${window.startTime} -> ${window.endTime}`
  //   );
  //   const storage = await postgres$;

  //   const [participants, pairs, operations, pushes] = await Promise.all([
  //     storage.getBillingParticipants(),
  //     storage.adminGetOrganizationsTargetPairs(),
  //     estimationApi.query('estimateOperationsForAllTargets', window),
  //     estimationApi.query('estiamteSchemaPushesForAllTargets', window),
  //   ]);

  //   logger.debug(
  //     `Fetched total of ${
  //       Object.keys(participants).length
  //     } participants from the DB`
  //   );
  //   logger.debug(
  //     `Fetched total of ${
  //       Object.keys(operations).length
  //     } targets with usage information`
  //   );
  //   logger.debug(
  //     `Fetched total of ${
  //       Object.keys(pushes).length
  //     } targets with schema push information`
  //   );

  //   await Promise.all(
  //     participants.map(async (participant) => {
  //       const relevantTargetIds = pairs
  //         .filter((v) => v.organization === participant.organizationId)
  //         .map((v) => v.target);

  //       if (relevantTargetIds.length === 0) {
  //         return;
  //       }

  //       const totalSchemaPushes = relevantTargetIds.reduce(
  //         (prev, targetId) => prev + (pushes[targetId] || 0),
  //         0
  //       );
  //       const totalOperations = relevantTargetIds.reduce(
  //         (prev, targetId) => prev + (operations[targetId] || 0),
  //         0
  //       );

  //       const subscriptions = await stripeApi.subscriptions
  //         .list({
  //           customer: participant.externalBillingReference,
  //         })
  //         .then((v) => v.data.filter((r) => r.metadata?.hive_subscription));

  //       if (subscriptions.length === 0) {
  //         return;
  //       }

  //       const actualSubscription = subscriptions[0];
  //       const subscriptionItems = actualSubscription.items.data;

  //       for (const item of subscriptionItems) {
  //         if (item.plan.id === stripePrices.operationsPrice.id) {
  //           const asThausands = Math.floor(totalOperations / 1000);
  //           logger.info(
  //             `Reported total of ${asThausands}K operations for org ${participant.organizationId}`
  //           );
  //           await stripeApi.subscriptionItems.createUsageRecord(item.id, {
  //             action: 'set',
  //             quantity: asThausands,
  //           });
  //         } else if (item.plan.id === stripePrices.schemaPushesPrice.id) {
  //           logger.info(
  //             `Reported total of ${totalSchemaPushes} schema pushes for org ${participant.organizationId}`
  //           );
  //           await stripeApi.subscriptionItems.createUsageRecord(item.id, {
  //             action: 'set',
  //             quantity: totalSchemaPushes,
  //           });
  //         }
  //       }
  //     })
  //   );
  // }

  return {
    postgres$,
    loadStripeData$,
    stripeApi,
    async readiness() {
      return await (await postgres$).isReady();
    },
    async start() {
      logger.info(
        `Stripe Billing Sync starting, will sync Stripe every ${config.stripe.syncIntervalMs}ms...`,
      );

      const stripeData = await loadStripeData$;
      logger.info(`Stripe is configured correctly, prices info: %o`, stripeData);

      // feat(metered-usage)
      // await estimateAndReport().catch((e) => {
      //   logger.error(e, `Failed to estimate and report`);
      // });

      // intervalHandle = setInterval(async () => {
      //   try {
      //     await estimateAndReport();
      //   } catch (e) {
      //     logger.error(e, `Failed to estimate and report`);
      //   }
      // }, config.stripe.syncIntervalMs);
    },
    async stop() {
      if (intervalHandle) {
        clearInterval(intervalHandle);
        intervalHandle = null;
      }

      await (await postgres$).destroy();

      logger.info(`Stripe Billing Sync stopped...`);
    },
  };
}
