import { ServiceLogger } from '@hive/service-common';
import { Environment, Paddle, Price } from '@paddle/paddle-node-sdk';

export function createPaddleBilling(config: {
  logger: ServiceLogger;
  paddle: {
    apiKey: string;
    environment: string;
  };
}) {
  const logger = config.logger;
  const paddleApi = new Paddle(config.paddle.apiKey, {
    environment:
      config.paddle.environment === 'sandbox' ? Environment.sandbox : Environment.production,
  });

  const loadPaddleData$ = ensurePaddleProducts();

  async function ensurePaddleProducts(): Promise<{
    operationsPrice: Price;
    basePrice: Price;
  }> {
    const relevantProducts = await paddleApi.products
      .list({
        status: ['active'],
        type: ['standard'],
      })
      .next()
      .then(r => r.filter(v => v.customData && 'hive_plan' in v.customData));

    if (relevantProducts.length !== 1) {
      throw new Error(
        `Invalid count of Hive products configured in Paddle: ${relevantProducts.length}`,
      );
    }

    const prices = await paddleApi.prices
      .list({
        productId: relevantProducts.map(r => r.id),
        status: ['active'],
      })
      .next();

    const operationsPrice = prices.find(
      v => v.customData && 'hive_usage' in v.customData && v.customData.hive_usage === 'operations',
    );

    if (!operationsPrice) {
      throw new Error(`Failed to find Paddle price ID with Hive metadata for operations`);
    }

    const basePrice = prices.find(
      v => v.customData && 'hive_usage' in v.customData && v.customData.hive_usage === 'base',
    );

    if (!basePrice) {
      throw new Error(`Failed to find Paddle price ID with Hive metadata for base price`);
    }

    return {
      operationsPrice,
      basePrice,
    };
  }

  return {
    loadPaddleData$,
    paddleApi,
    async readiness() {
      return await loadPaddleData$.then(() => true).catch(() => false);
    },
    async start() {
      logger.info(`Paddle Billing starting`);
      const paddleData = await loadPaddleData$;
      logger.info(`Paddle is configured correctly, prices info: %o`, paddleData);
    },
    async stop() {
      logger.info(`Paddle Billing Sync stopped...`);
    },
  };
}
