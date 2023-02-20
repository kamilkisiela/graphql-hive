import { createErrorHandler, reportReadiness } from "@hive/service-common";
import { createFetchAPIHandler } from "@valu/trpc-fetch-api-adapter";
import { createLogger } from "@hive/service-common";
import { Context, tokensApiRouter } from "./api";
import { env } from "./environment";
import ms from "ms";
import { useCache } from "./cache";
import { createStorage } from "./storage";
import LRU from "tiny-lru";
import { createRouter } from "@whatwg-node/router";
import Redis from "ioredis";

const tokensRouter = createRouter();

const logger = createLogger(env.log.level);

const errorHandler = createErrorHandler({
  log: { error: logger.error },
} as any);

const redis = new Redis({
  host: env.redis.host,
  port: env.redis.port,
  password: env.redis.password,
  maxRetriesPerRequest: 20,
  db: 0,
  enableReadyCheck: false,
});

const {
  readiness: cacheReadiness,
  start: startCache,
  stop: stopCache,
  getStorage,
} = useCache(createStorage(env.postgres), redis, logger);

// Cache failures for 1 minute
const errorCachingInterval = ms("1m");
const tokenReadFailuresCache = LRU<string>(1000, errorCachingInterval);

const respondWithTRPC = createFetchAPIHandler({
  router: tokensApiRouter,
  async createContext(req: any): Promise<Context> {
    return {
      req,
      errorHandler,
      getStorage,
      tokenReadFailuresCache,
    };
  },
});

tokensRouter.all("/trpc/:path+", async (req: any) => {
  return await respondWithTRPC(req);
});

tokensRouter.all("/_health", (req) => {
  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD") {
    return new Response(null, {
      status: 200,
    });
  }
  // return nothing so router can continue with other middlewares if exist
});

tokensRouter.all("/_readiness", (req) => {
  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD") {
    const isReady = cacheReadiness();
    reportReadiness(isReady);

    return new Response(null, {
      status: isReady ? 200 : 400,
    });
  }
  // return nothing so router can continue with other middlewares if exist
});

export { tokensRouter, cacheReadiness, startCache, stopCache, redis as redisInstance };
