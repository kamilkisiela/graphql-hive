import { Router } from 'itty-router';
import { createLogger, FastifyLoggerInstance, reportReadiness } from '@hive/service-common';
import { createConnectionString } from '@hive/storage';
import { createRateLimiter } from './limiter';
import { env } from './environment';
import { createFetchAPIHandler } from '@valu/trpc-fetch-api-adapter';
import { rateLimitApiRouter } from './api';

const rateLimitRouter: Router = Router();

const logger = createLogger(env.log.level) as FastifyLoggerInstance;

const ctx = createRateLimiter({
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
  createContext: async (): Promise<any> => ctx,
});

rateLimitRouter.all('/trpc/:path+', async (req: any) => {
  return await respondWithTRPC(req);
});

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
    const isReady = ctx.readiness();
    reportReadiness(isReady);

    return new Response(null, {
      status: isReady ? 200 : 400,
    });
  }
  // return nothing so router can continue with other middlewares if exist
});

export { ctx as rateLimitCtX, rateLimitRouter };
