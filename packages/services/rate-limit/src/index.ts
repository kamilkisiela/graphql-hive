#!/usr/bin/env node
import 'reflect-metadata';
import {
  createServer,
  registerShutdown,
  registerTRPC,
  reportReadiness,
  startMetrics,
} from '@hive/service-common';
import { createConnectionString } from '@hive/storage';
import * as Sentry from '@sentry/node';
import { Context, rateLimitApiRouter } from './api';
import { env } from './environment';
import { createRateLimiter } from './limiter';

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
    log: {
      level: env.log.level,
      requests: env.log.requests,
    },
  });

  try {
    const limiter = createRateLimiter({
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

    await registerTRPC(server, {
      router: rateLimitApiRouter,
      createContext({ req }): Context {
        return {
          req,
          limiter,
        };
      },
    });

    registerShutdown({
      logger: server.log,
      async onShutdown() {
        await Promise.all([limiter.stop(), server.close()]);
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
      async handler(_, res) {
        const isReady = await limiter.readiness();
        reportReadiness(isReady);
        void res.status(isReady ? 200 : 400).send();
      },
    });

    if (env.prometheus) {
      await startMetrics(env.prometheus.labels.instance);
    }
    await server.listen(env.http.port, '::');
    await limiter.start();
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
