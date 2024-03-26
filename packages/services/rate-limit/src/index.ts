#!/usr/bin/env node
import 'reflect-metadata';
import { hostname } from 'os';
import {
  configureTracing,
  createServer,
  registerShutdown,
  registerTRPC,
  reportReadiness,
  startMetrics,
  TracingInstance,
} from '@hive/service-common';
import { createConnectionString } from '@hive/storage';
import * as Sentry from '@sentry/node';
import { Context, rateLimitApiRouter } from './api';
import { env } from './environment';
import { createRateLimiter } from './limiter';

async function main() {
  let tracing: TracingInstance | undefined;

  if (env.tracing.enabled && env.tracing.collectorEndpoint) {
    tracing = configureTracing({
      collectorEndpoint: env.tracing.collectorEndpoint,
      serviceName: 'rate-limit',
    });

    tracing.instrumentNodeFetch();
    tracing.build();
    tracing.start();
  }

  if (env.sentry) {
    Sentry.init({
      serverName: hostname(),
      dist: 'rate-limit',
      enabled: !!env.sentry,
      environment: env.environment,
      dsn: env.sentry.dsn,
      release: env.release,
    });
  }

  const server = await createServer({
    name: 'rate-limit',
    sentryErrorHandler: true,
    log: {
      level: env.log.level,
      requests: env.log.requests,
    },
  });

  if (tracing) {
    await server.register(...tracing.instrumentFastify());
  }

  try {
    const limiter = createRateLimiter({
      cacheTtl: env.limitCacheUpdateIntervalMs,
      logger: server.log,
      usageEstimator: env.hiveServices.usageEstimator,
      emails: env.hiveServices.emails ?? undefined,
      storage: {
        connectionString: createConnectionString(env.postgres),
        additionalInterceptors: tracing ? [tracing.instrumentSlonik()] : undefined,
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

    await limiter.start();

    if (env.prometheus) {
      await startMetrics(env.prometheus.labels.instance);
    }

    await server.listen({
      port: env.http.port,
      host: '::',
    });
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
