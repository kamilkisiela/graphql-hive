import { Stripe } from 'stripe';
import { ServiceLogger } from '@hive/service-common';
import { createStorage as createPostgreSQLStorage, Interceptor } from '@hive/storage';

export function createStripeBilling(config: {
  logger: ServiceLogger;
  rateEstimator: {
    endpoint: string;
  };
  storage: {
    connectionString: string;
    additionalInterceptors?: Interceptor[];
  };
  stripe: {
    token: string;
    syncIntervalMs: number;
  };
}) {
  const logger = config.logger;
  const postgres$ = createPostgreSQLStorage(
    config.storage.connectionString,
    10,
    config.storage.additionalInterceptors,
  );
  const stripeApi = new Stripe(config.stripe.token, {
    apiVersion: '2023-10-16',
    typescript: true,
    httpClient: Stripe.createFetchHttpClient(fetch),
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
    },
    async stop() {
      await (await postgres$).destroy();

      logger.info(`Stripe Billing Sync stopped...`);
    },
  };
}
