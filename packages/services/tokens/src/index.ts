#!/usr/bin/env node
import 'reflect-metadata';
import {
  createServer,
  createErrorHandler,
  startMetrics,
  registerShutdown,
  reportReadiness,
  startHeartbeats,
} from '@hive/service-common';
import * as Sentry from '@sentry/node';
import LRU from 'tiny-lru';
import ms from 'ms';
import { createStorage } from './storage';
import { useCache } from './cache';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify/dist/trpc-server-adapters-fastify.cjs.js';
import type { CreateFastifyContextOptions } from '@trpc/server/adapters/fastify';
import { Context, tokensApiRouter } from './api';

export async function main() {
  Sentry.init({
    serverName: 'tokens',
    enabled: String(process.env.SENTRY_ENABLED) === '1',
    environment: process.env.ENVIRONMENT,
    dsn: process.env.SENTRY_DSN,
    release: process.env.RELEASE || 'local',
  });

  const server = await createServer({
    name: 'tokens',
    tracing: false,
  });

  const errorHandler = createErrorHandler(server);

  try {
    const { start, stop, readiness, getStorage } = useCache(createStorage(), server.log);
    const tokenReadFailuresCache = LRU<{
      error: string;
      checkAt: number;
    }>(50);
    const errorCachingInterval = ms('10m');

    const stopHeartbeats =
      typeof process.env.HEARTBEAT_ENDPOINT === 'string' && process.env.HEARTBEAT_ENDPOINT.length > 0
        ? startHeartbeats({
            enabled: true,
            endpoint: process.env.HEARTBEAT_ENDPOINT,
            intervalInMS: 20_000,
            onError: server.log.error,
            isReady: readiness,
          })
        : startHeartbeats({ enabled: false });

    registerShutdown({
      logger: server.log,
      async onShutdown() {
        stopHeartbeats();
        await server.close();
        await stop();
      },
    });

    const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 6001;

    await server.register(fastifyTRPCPlugin, {
      prefix: '/trpc',
      trpcOptions: {
        router: tokensApiRouter,
        createContext({ req }: CreateFastifyContextOptions): Context {
          return {
            errorCachingInterval,
            logger: req.log,
            errorHandler,
            getStorage,
            tokenReadFailuresCache,
          };
        },
      },
    });

    server.route({
      method: ['GET', 'HEAD'],
      url: '/_health',
      handler(req, res) {
        res.status(200).send(); // eslint-disable-line @typescript-eslint/no-floating-promises -- false positive, FastifyReply.then returns void
      },
    });

    server.route({
      method: ['GET', 'HEAD'],
      url: '/_readiness',
      handler(_, res) {
        const isReady = readiness();
        reportReadiness(isReady);
        res.status(isReady ? 200 : 400).send(); // eslint-disable-line @typescript-eslint/no-floating-promises -- false positive, FastifyReply.then returns void
      },
    });

    if (process.env.METRICS_ENABLED === 'true') {
      await startMetrics();
    }
    await server.listen({
      port,
      host: '0.0.0.0',
    });
    await start();
  } catch (error) {
    server.log.fatal(error);
    Sentry.captureException(error, {
      level: 'fatal',
    });
    process.exit(1);
  }
}

main().catch(err => {
  Sentry.captureException(err, {
    level: 'fatal',
  });
  console.error(err);
  process.exit(1);
});
