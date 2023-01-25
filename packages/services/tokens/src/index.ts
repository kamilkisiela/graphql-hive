#!/usr/bin/env node
import ms from 'ms';
import 'reflect-metadata';
import LRU from 'tiny-lru';
import {
  createErrorHandler,
  createServer,
  registerShutdown,
  reportReadiness,
  startHeartbeats,
  startMetrics,
} from '@hive/service-common';
import * as Sentry from '@sentry/node';
import type { CreateFastifyContextOptions } from '@trpc/server/adapters/fastify';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import { Context, tokensApiRouter } from './api';
import { useCache } from './cache';
import { env } from './environment';
import { createStorage } from './storage';

export async function main() {
  if (env.sentry) {
    Sentry.init({
      serverName: 'tokens',
      enabled: true,
      environment: env.environment,
      dsn: env.sentry.dsn,
      release: env.release,
    });
  }

  const server = await createServer({
    name: 'tokens',
    tracing: false,
    log: {
      level: env.log.level,
      requests: env.log.requests,
    },
  });

  const errorHandler = createErrorHandler(server);

  try {
    const { start, stop, readiness, getStorage } = useCache(
      createStorage(env.postgres),
      server.log,
    );
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
    // Cache failures for 10 minutes
    const errorCachingInterval = ms('10m');

    const stopHeartbeats = env.heartbeat
      ? startHeartbeats({
          enabled: true,
          endpoint: env.heartbeat.endpoint,
          intervalInMS: 20_000,
          onError: e => server.log.error(e, `Heartbeat failed with error`),
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
        void res.status(200).send();
      },
    });

    server.route({
      method: ['GET', 'HEAD'],
      url: '/_readiness',
      handler(_, res) {
        const isReady = readiness();
        reportReadiness(isReady);
        void res.status(isReady ? 200 : 400).send();
      },
    });

    if (env.prometheus) {
      await startMetrics(env.prometheus.labels.instance);
    }
    await server.listen(env.http.port, '0.0.0.0');
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
