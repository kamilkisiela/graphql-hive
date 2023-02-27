#!/usr/bin/env node
import { createServer } from 'http';
import 'reflect-metadata';
import { registerShutdown, reportReadiness, startMetrics } from '@hive/service-common';
import { createConnectionString } from '@hive/storage';
import * as Sentry from '@sentry/node';
import { logger, rateLimitApiRouter } from './api';
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

  try {
    const limiter = createRateLimiter({
      logger,
      rateLimitConfig: {
        interval: env.limitCacheUpdateIntervalMs,
      },
      rateEstimator: env.hiveServices.usageEstimator,
      emails: env.hiveServices.emails ?? undefined,
      storage: {
        connectionString: createConnectionString(env.postgres),
      },
    });

    const server = createServer((req, res) => rateLimitApiRouter(req, res, { limiter }));

    registerShutdown({
      logger,
      async onShutdown() {
        await Promise.all([limiter.stop(), server.close()]);
      },
    });

    rateLimitApiRouter.route({
      method: 'GET',
      path: '/_health',
      handler: () => new Response('OK', { status: 200 }),
    });

    rateLimitApiRouter.route({
      method: 'GET',
      path: '/_readiness',
      handler: () => {
        const isReady = limiter.readiness();
        reportReadiness(isReady);
        return new Response(isReady ? 'OK' : 'Not ready', { status: isReady ? 200 : 400 });
      },
    });

    if (env.prometheus) {
      await startMetrics(env.prometheus.labels.instance);
    }
    await new Promise<void>(resolve => server.listen(env.http.port, '::', resolve));
    await limiter.start();
  } catch (error) {
    logger.error(error);
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
