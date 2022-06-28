#!/usr/bin/env node
import {
  createServer,
  createErrorHandler,
  ensureEnv,
  startMetrics,
  registerShutdown,
  reportReadiness,
  startHeartbeats,
} from '@hive/service-common';
import * as Sentry from '@sentry/node';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import type { CreateFastifyContextOptions } from '@trpc/server/adapters/fastify';
import { createScheduler } from './scheduler';
import { webhooksApiRouter } from './api';
import type { Context } from './types';

async function main() {
  Sentry.init({
    serverName: 'schema',
    enabled: process.env.ENVIRONMENT === 'prod',
    environment: process.env.ENVIRONMENT,
    dsn: process.env.SENTRY_DSN,
    release: process.env.RELEASE || 'local',
  });

  const server = await createServer({
    name: 'webhooks',
    tracing: false,
  });

  const errorHandler = createErrorHandler(server);

  try {
    const port = process.env.PORT || 6250;

    const { schedule, readiness, start, stop } = createScheduler({
      logger: server.log,
      redis: {
        host: ensureEnv('REDIS_HOST'),
        port: ensureEnv('REDIS_PORT', 'number'),
        password: ensureEnv('REDIS_PASSWORD'),
      },
      webhookQueueName: 'webhook',
      maxAttempts: 10,
      backoffDelay: 2000,
    });

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
        await stop();
      },
    });

    await server.register(fastifyTRPCPlugin, {
      prefix: '/trpc',
      trpcOptions: {
        router: webhooksApiRouter,
        createContext({ req }: CreateFastifyContextOptions): Context {
          return { logger: req.log, errorHandler, schedule };
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

    await server.listen(port, '0.0.0.0');

    if (process.env.METRICS_ENABLED === 'true') {
      await startMetrics();
    }

    await start();
  } catch (error) {
    server.log.fatal(error);
    Sentry.captureException(error, {
      level: Sentry.Severity.Fatal,
    });
    process.exit(1);
  }
}

main().catch(err => {
  Sentry.captureException(err, {
    level: Sentry.Severity.Fatal,
  });
  console.error(err);
  process.exit(1);
});
