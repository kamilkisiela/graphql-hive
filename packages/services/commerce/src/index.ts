#!/usr/bin/env node
import 'reflect-metadata';
import { createConnectionStringProvider } from '@hive/postgres';
import {
  configureTracing,
  createServer,
  generateRdsIamAuthToken,
  registerShutdown,
  registerTRPC,
  reportReadiness,
  sentryInit,
  startMetrics,
  TracingInstance,
} from '@hive/service-common';
import { createStorage } from '@hive/storage';
import { TaskScheduler } from '@hive/workflows/kit';
import * as Sentry from '@sentry/node';
import { commerceRouter } from './api';
import { env } from './environment';
import { createRateLimiter } from './rate-limit/limiter';
import { createStripeBilling } from './stripe-billing/billing';
import { createEstimator } from './usage-estimator/estimator';

async function main() {
  let tracing: TracingInstance | undefined;

  if (env.tracing.enabled && env.tracing.collectorEndpoint) {
    tracing = configureTracing({
      collectorEndpoint: env.tracing.collectorEndpoint,
      serviceName: 'commerce',
    });

    tracing.instrumentNodeFetch();
    tracing.setup();
  }

  if (env.sentry) {
    sentryInit({
      dist: 'commerce',
      enabled: !!env.sentry,
      environment: env.environment,
      dsn: env.sentry.dsn,
      release: env.release,
    });
  }

  const server = await createServer({
    name: 'commerce',
    sentryErrorHandler: true,
    warnOnMissingRequestId: true,
    log: {
      level: env.log.level,
      requests: env.log.requests,
    },
  });

  try {
    const rdsIamTokenGenerator = env.postgres.awsIamAuthEnabled
      ? () =>
          generateRdsIamAuthToken(
            {
              region: env.postgres.awsRegion ?? '',
              hostname: env.postgres.host,
              port: env.postgres.port,
              username: env.postgres.user,
            },
            server.log.child({ source: 'RdsIamAuthTokenGenerator' }),
          )
      : undefined;

    const storage = await createStorage(
      createConnectionStringProvider(env.postgres, rdsIamTokenGenerator),
      5,
      tracing ? [tracing.instrumentSlonik()] : undefined,
    );

    const taskScheduler = new TaskScheduler(storage.pool);

    const usageEstimator = createEstimator({
      logger: server.log,
      clickhouse: {
        protocol: env.clickhouse.protocol,
        host: env.clickhouse.host,
        port: env.clickhouse.port,
        username: env.clickhouse.username,
        password: env.clickhouse.password,
        database: env.clickhouse.database,
      },
    });

    const rateLimiter = createRateLimiter({
      logger: server.log,
      rateLimitConfig: {
        interval: env.rateLimit.limitCacheUpdateIntervalMs,
      },
      usageEstimator,
      taskScheduler,
      storage,
    });

    const stripeBilling = createStripeBilling({
      logger: server.log,
      stripe: {
        token: env.stripe.secretKey,
        syncIntervalMs: env.stripe.syncIntervalMs,
      },
      usageEstimator,
      storage,
    });

    registerShutdown({
      logger: server.log,
      async onShutdown() {
        await server.close();
        await Promise.all([usageEstimator.stop(), rateLimiter.stop(), stripeBilling.stop()]);
        await storage.destroy();
      },
    });

    await registerTRPC(server, {
      router: commerceRouter,
      createContext({ req }) {
        return {
          req,
          usageEstimator,
          rateLimiter,
          stripeBilling,
        };
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
        const readinessChecks = await Promise.all([
          usageEstimator.readiness(),
          rateLimiter.readiness(),
          storage.isReady(),
        ]);
        const isReady = readinessChecks.every(val => val === true);
        reportReadiness(isReady);
        void res.status(isReady ? 200 : 400).send();
      },
    });

    if (env.prometheus) {
      await startMetrics(env.prometheus.labels.instance, {
        port: env.prometheus.port,
        host: env.http.host,
        ipv6Only: env.http.ipv6Only,
      });
    }
    await server.listen({
      port: env.http.port,
      host: env.http.host,
      ipv6Only: env.http.ipv6Only,
    });
    await Promise.all([usageEstimator.start(), rateLimiter.start(), stripeBilling.start()]);
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
