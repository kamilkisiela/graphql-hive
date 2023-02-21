import { createLogger, reportReadiness } from '@hive/service-common';
import { createConnectionString } from '@hive/storage';
import { createFetchAPIHandler } from '@valu/trpc-fetch-api-adapter';
import { createRouter } from '@whatwg-node/router';
import { rateLimitApiRouter } from './api';
import { env } from './environment';
import { createRateLimiter } from './limiter';

export const rateLimitRouter = createRouter();

const logger = createLogger(env.log.level);

export const rateLimitContext = createRateLimiter({
  logger,
  rateLimitConfig: {
    interval: env.limitCacheUpdateIntervalMs,
  },
  rateEstimator: env.hiveServices.usageEstimator,
  emails: env.hiveServices.emails ?? undefined,
  storage: {
    connectionString: createConnectionString(env.postgres),
  },
});

const respondWithTRPC = createFetchAPIHandler({
  router: rateLimitApiRouter,
  createContext: async (): Promise<any> => rateLimitContext,
});

rateLimitRouter.all('/trpc/:path+', respondWithTRPC);

rateLimitRouter.all('/_health', req => {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD') {
    return new Response(null, {
      status: 200,
    });
  }
  // return nothing so router can continue with other middlewares if exist
});

rateLimitRouter.all('/_readiness', req => {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD') {
    const isReady = rateLimitContext.readiness();
    reportReadiness(isReady);

    return new Response(null, {
      status: isReady ? 200 : 400,
    });
  }
  // return nothing so router can continue with other middlewares if exist
});
