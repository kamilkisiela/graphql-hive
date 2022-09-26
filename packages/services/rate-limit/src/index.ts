#!/usr/bin/env node
import 'reflect-metadata';
import * as Sentry from '@sentry/node';
import { createServer, startMetrics, registerShutdown, reportReadiness } from '@hive/service-common';
import { createRateLimiter } from './limiter';
import { createConnectionString } from '@hive/storage';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify/dist/trpc-server-adapters-fastify.cjs.js';
import { rateLimitApiRouter } from './api';
import { env } from './environment';

async function main() {
  if (env.sentry) {
    Sentry.init({
      serverName: 'rate-limit',
      enabled: !!env.sentry,
      environment: env.environment,
      dsn: env.sentry.dsn,
      release: env.release,
    });
  }

  const server = await createServer({
    name: 'rate-limit',
    tracing: false,
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
        res.status(200).send(); // eslint-disable-line @typescript-eslint/no-floating-promises -- false positive, FastifyReply.then returns void
      },
    });

    server.route({
      method: ['GET', 'HEAD'],
      url: '/_readiness',
      handler(_, res) {
        const isReady = ctx.readiness();
        reportReadiness(isReady);
        res.status(isReady ? 200 : 400).send(); // eslint-disable-line @typescript-eslint/no-floating-promises -- false positive, FastifyReply.then returns void
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
