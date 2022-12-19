#!/usr/bin/env node
import {
  createErrorHandler,
  startMetrics,
  registerShutdown,
  reportReadiness,
  startHeartbeats,
  FastifyLoggerInstance,
} from '@hive/service-common';
import * as Sentry from '@sentry/node';
import type { CreateFastifyContextOptions } from '@trpc/server/adapters/fastify';
import { createScheduler } from './scheduler';
import { webhooksApiRouter } from './api';
import type { Context } from './types';
import { env } from './environment';
import { Router } from 'itty-router';
import { createServerAdapter } from '@whatwg-node/server';
import { createServer } from 'http';
import { createLogger } from 'packages/services/service-common/src/logger';
import * as trpcNode from '@trpc/server/adapters/node-http';

async function main() {
  if (env.sentry) {
    Sentry.init({
      serverName: 'webhooks',
      enabled: !!env.sentry,
      environment: env.environment,
      dsn: env.sentry.dsn,
      release: env.release,
    });
  }

  const app = createServerAdapter(Router());

  const logger = createLogger(env.log.level) as FastifyLoggerInstance;
  const errorHandler = createErrorHandler({ log: { error: logger.error } } as any);

  try {
    const { schedule, readiness, start, stop } = createScheduler({
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

    const stopHeartbeats = env.heartbeat
      ? startHeartbeats({
          enabled: true,
          endpoint: env.heartbeat.endpoint,
          intervalInMS: 20_000,
          onError: logger.error,
          isReady: readiness,
        })
      : startHeartbeats({ enabled: false });

    registerShutdown({
      logger,
      async onShutdown() {
        stopHeartbeats();
        await stop();
      },
    });

    app.all('/trpc', (req: any, res) => {
      return trpcNode.nodeHTTPRequestHandler({
        req,
        res,
        path: '/trpc',
        router: webhooksApiRouter,
        createContext({ req }: CreateFastifyContextOptions): Context {
          return { logger: req.log, errorHandler, schedule };
        },
      });
    });

    app.get('/_health', () => {
      return new Response(null, {
        status: 200,
      });
    });

    app.get('/_readiness', () => {
      const isReady = readiness();
      reportReadiness(isReady);

      return new Response(null, {
        status: isReady ? 200 : 400,
      });
    });

    const server = createServer(app);

    if (env.prometheus) {
      await startMetrics(env.prometheus.labels.instance);
    }

    await start();
    return new Promise<void>(resolve => {
      server.listen(env.http.port, '0.0.0.0', resolve);
    });
  } catch (error) {
    logger.error(error);
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
