import { reportReadiness } from '@hive/service-common';
import { createFetchAPIHandler } from '@valu/trpc-fetch-api-adapter';
import { createLogger } from '@hive/service-common';
import { usageEstimatorApiRouter } from './api';
import { env } from './environment';
import { createEstimator } from './estimator';
import { clickHouseElapsedDuration, clickHouseReadDuration } from './metrics';
// eslint-disable-next-line import/no-extraneous-dependencies
import { createRouter } from '@whatwg-node/router'

const usageEstimatorRouter = createRouter();

const logger = createLogger(env.log.level);

const estimatorContext = createEstimator({
  logger,
  clickhouse: {
    protocol: env.clickhouse.protocol,
    host: env.clickhouse.host,
    port: env.clickhouse.port,
    username: env.clickhouse.username,
    password: env.clickhouse.password,
    onReadEnd(query, timings) {
      clickHouseReadDuration.labels({ query }).observe(timings.totalSeconds);
      clickHouseElapsedDuration.labels({ query }).observe(timings.elapsedSeconds);
    },
  },
});

const respondWithTRPC = createFetchAPIHandler({
  router: usageEstimatorApiRouter,
  async createContext(): Promise<any> {
    return estimatorContext;
  },
});

usageEstimatorRouter.all('/trpc/:path+', async (req: any) => {
  return await respondWithTRPC(req);
});

usageEstimatorRouter.all('/_health', req => {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD') {
    return new Response(null, {
      status: 200,
    });
  }
  // return nothing so router can continue with other middlewares if exist
});

usageEstimatorRouter.all('/_readiness', req => {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD') {
    const isReady = estimatorContext.readiness();
    reportReadiness(isReady);

    return new Response(null, {
      status: isReady ? 200 : 400,
    });
  }
  // return nothing so router can continue with other middlewares if exist
});

export { usageEstimatorRouter, estimatorContext };
