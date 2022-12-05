#!/usr/bin/env node
import 'reflect-metadata';
import * as Sentry from '@sentry/node';
import {
  createServer,
  startMetrics,
  registerShutdown,
  reportReadiness,
} from '@hive/service-common';
import { createRateLimiter } from './limiter';
import { createConnectionString } from '@hive/storage';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import { rateLimitApiRouter } from './api';
import { env } from './environment';

async function main() {
  if (env.sentry) {
    Sentry.init({
      serverName: 'rate-limit',
      enabled: Boolean(env.sentry),
      environment: env.environment,
      dsn: env.sentry.dsn,
      release: env.release,
    });
  }

  const server = await createServer({
    name: 'rate-limit',
    tracing: false,
    log: {
      level: env.log.level,
    },
  });

  try {
    const ctx = createRateLimiter({
      logger: server.log,
      rateLimitConfig: {
        interval: env.limitCacheUpdateIntervalMs,
      },
      rateEstimator: env.hiveServices.usageEstimator,
      emails: env.hiveServices.emails ?? undefined,
      storage: {
        connectionString: createConnectionString(env.postgres),
      },
    });

    await server.register(fastifyTRPCPlugin, {
      prefix: '/trpc',
      trpcOptions: {
        router: rateLimitApiRouter,
        createContext: () => ctx,
      },
    });

    registerShutdown({
      logger: server.log,
      async onShutdown() {
        await Promise.all([ctx.stop(), server.close()]);
      },
    });

    server.route({
      method: ['GET', 'HEAD'],
      url: '/_health',
      handler(_, res) {
        void res.status(200).send();
      },
    });

    server.route({
      method: ['GET', 'HEAD'],
      url: '/_readiness',
      handler(_, res) {
        const isReady = ctx.readiness();
        reportReadiness(isReady);
        void res.status(isReady ? 200 : 400).send();
      },
    });

    if (env.prometheus) {
      await startMetrics(env.prometheus.labels.instance);
    }
    await server.listen(env.http.port, '0.0.0.0');
    await ctx.start();
  } catch (error) {
    server.log.fatal(error);
    Sentry.captureException(error, {
      level: 'fatal',
    });
  }
}

main().catch(err => {
  Sentry.captureException(err, {
    level: 'fatal',
  });
  console.error(err);
  process.exit(1);
});
