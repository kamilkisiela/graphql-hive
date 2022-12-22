import { createErrorHandler, FastifyLoggerInstance, reportReadiness } from '@hive/service-common';
import { createFetchAPIHandler } from '@valu/trpc-fetch-api-adapter';
import { Router } from 'itty-router';
import { createLogger } from '@hive/service-common';
import { webhooksApiRouter } from './api';
import { Context } from './types';
import { env } from './environment';
import { createScheduler } from './scheduler';

const webhooksRouter: Router = Router();

const logger = createLogger(env.log.level) as FastifyLoggerInstance;

const {
  schedule,
  readiness: schedularReadiness,
  start: startSchedular,
  stop: stopSchedular,
} = createScheduler({
  logger,
  redis: {
    host: env.redis.host,
    port: env.redis.port,
    password: env.redis.password,
  },
  webhookQueueName: 'webhook',
  maxAttempts: 10,
  backoffDelay: 2000,
  requestBroker: env.requestBroker,
});

const errorHandler = createErrorHandler({
  log: { error: logger.error },
} as any);

const respondWithTRPC = createFetchAPIHandler({
  router: webhooksApiRouter,
  async createContext({ req }: any): Promise<Context> {
    return { logger: req.log, errorHandler, schedule };
  },
});

webhooksRouter.all('/trpc/:path+', async (req: any) => {
  return await respondWithTRPC(req);
});

webhooksRouter.all('/_health', req => {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD') {
    return new Response(null, {
      status: 200,
    });
  }
  // return nothing so router can continue with other middlewares if exist
});

webhooksRouter.all('/_readiness', req => {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD') {
    const isReady = schedularReadiness();
    reportReadiness(isReady);

    return new Response(null, {
      status: isReady ? 200 : 400,
    });
  }
  // return nothing so router can continue with other middlewares if exist
});

export { webhooksRouter, startSchedular, stopSchedular, schedularReadiness };
