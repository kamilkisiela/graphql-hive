#!/usr/bin/env node
import 'reflect-metadata';
import {
  createServer,
  createErrorHandler,
  startMetrics,
  registerShutdown,
} from '@hive/service-common';
import * as Sentry from '@sentry/node';
import LRU from 'tiny-lru';
import ms from 'ms';
import { createStorage } from './storage';
import { useCache } from './cache';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify/dist/trpc-server-adapters-fastify.cjs.js';
import { Context, tokensApiRouter } from './api';

export async function main() {
  Sentry.init({
    serverName: 'tokens',
    enabled: process.env.ENVIRONMENT === 'prod',
    environment: process.env.ENVIRONMENT,
    dsn: process.env.SENTRY_DSN,
    release: process.env.RELEASE || 'local',
  });

  const server = createServer({
    name: 'tokens',
    tracing: false,
  });

  const errorHandler = createErrorHandler(server);

  try {
    const { start, stop, readiness, getStorage } = useCache(
      createStorage(),
      server.log
    );
    const tokenReadFailuresCache = LRU<{
      error: string;
      checkAt: number;
    }>(50);
    const errorCachingInterval = ms('10m');

    registerShutdown({
      logger: server.log,
      async onShutdown() {
        await server.close();
        await stop();
      },
    });

    const port = process.env.PORT || 6001;

    const context: Context = {
      errorCachingInterval,
      logger: server.log,
      errorHandler,
      getStorage,
      tokenReadFailuresCache,
    };

    server.register(fastifyTRPCPlugin, {
      prefix: '/trpc',
      trpcOptions: {
        router: tokensApiRouter,
        createContext: () => context,
      },
    });

    server.route({
      method: ['GET', 'HEAD'],
      url: '/_health',
      handler(req, res) {
        res.status(200).send();
      },
    });

    server.route({
      method: ['GET', 'HEAD'],
      url: '/_readiness',
      handler(_, res) {
        res.status(readiness() ? 200 : 400).send();
      },
    });

    if (process.env.METRICS_ENABLED === 'true') {
      await startMetrics();
    }
    await server.listen(port, '0.0.0.0');
    await start();
  } catch (error) {
    server.log.fatal(error);
    Sentry.captureException(error, {
      level: Sentry.Severity.Fatal,
    });
    process.exit(1);
  }
}

main().catch((err) => {
  Sentry.captureException(err, {
    level: Sentry.Severity.Fatal,
  });
  console.error(err);
  process.exit(1);
});
