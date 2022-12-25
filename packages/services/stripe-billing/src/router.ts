import { FastifyLoggerInstance, reportReadiness } from '@hive/service-common';
import { createFetchAPIHandler } from '@valu/trpc-fetch-api-adapter';
import { Router } from 'itty-router';
import { createLogger } from '@hive/service-common';
import { Context, stripeBillingApiRouter } from './api';
import { env } from './environment';
import { createConnectionString } from '@hive/storage';
import { createStripeBilling } from './billing-sync';

const stripeBillingRouter: Router = Router();

const logger = createLogger(env.log.level) as FastifyLoggerInstance;

const {
  readiness: stripeBillingReadiness,
  start: startStripeBilling,
  stop: stopStripeBilling,
  stripeApi,
  postgres$,
  loadStripeData$,
} = createStripeBilling({
  logger,
  stripe: {
    token: env.stripe.secretKey,
    syncIntervalMs: env.stripe.syncIntervalMs,
  },
  rateEstimator: {
    endpoint: env.hiveServices.usageEstimator.endpoint,
  },
  storage: {
    connectionString: createConnectionString(env.postgres),
  },
});

const context: Context = {
  storage$: postgres$,
  stripe: stripeApi,
  stripeData$: loadStripeData$,
};

const respondWithTRPC = createFetchAPIHandler({
  router: stripeBillingApiRouter,
  createContext: async (): Promise<Context> => context,
});

stripeBillingRouter.all('/trpc/:path+',  createFetchAPIHandler({
  router: stripeBillingApiRouter,
  createContext: async (): Promise<Context> => context,
}))
  return await respondWithTRPC(req);
});

stripeBillingRouter.all('/_health', req => {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD') {
    return new Response(null, {
      status: 200,
    });
  }
  // return nothing so router can continue with other middlewares if exist
});

stripeBillingRouter.all('/_readiness', req => {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD') {
    const isReady = stripeBillingReadiness();
    reportReadiness(isReady);

    return new Response(null, {
      status: isReady ? 200 : 400,
    });
  }
  // return nothing so router can continue with other middlewares if exist
});

export { stripeBillingRouter, stripeBillingReadiness, startStripeBilling, stopStripeBilling };
