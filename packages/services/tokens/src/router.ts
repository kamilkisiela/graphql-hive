import { createErrorHandler, FastifyLoggerInstance, reportReadiness } from '@hive/service-common';
import { createFetchAPIHandler } from '@valu/trpc-fetch-api-adapter';
import { Router } from 'itty-router';
import { createLogger } from '@hive/service-common';
import { Context, tokensApiRouter } from './api';
import { env } from './environment';
import ms from 'ms';
import { useCache } from './cache';
import { createStorage } from './storage';
import LRU from 'tiny-lru';

const tokensRouter: Router = Router();

const logger = createLogger(env.log.level) as FastifyLoggerInstance;

const tokenReadFailuresCache = LRU<
  | {
      type: 'error';
      error: string;
      checkAt: number;
    }
  | {
      type: 'not-found';
      checkAt: number;
    }
>(200);

const {
  readiness: cacheReadiness,
  start: startCache,
  stop: stopCache,
  getStorage,
} = useCache(createStorage(env.postgres), logger);

// Cache failures for 10 minutes
const errorCachingInterval = ms('10m');
const errorHandler = createErrorHandler({
  log: { error: logger.error },
} as any);

const respondWithTRPC = createFetchAPIHandler({
  router: tokensApiRouter,
  async createContext(): Promise<Context> {
    return {
      errorCachingInterval,
      logger,
      errorHandler,
      getStorage,
      tokenReadFailuresCache,
    };
  },
});

tokensRouter.all('/trpc/:path+', async (req: any) => {
  return await respondWithTRPC(req);
});

tokensRouter.all('/_health', req => {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD') {
    return new Response(null, {
      status: 200,
    });
  }
  // return nothing so router can continue with other middlewares if exist
});

tokensRouter.all('/_readiness', req => {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD') {
    const isReady = cacheReadiness();
    reportReadiness(isReady);

    return new Response(null, {
      status: isReady ? 200 : 400,
    });
  }
  // return nothing so router can continue with other middlewares if exist
});

export { tokensRouter, cacheReadiness, startCache, stopCache };
