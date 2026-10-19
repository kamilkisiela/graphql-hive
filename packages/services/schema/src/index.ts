#!/usr/bin/env node
import 'reflect-metadata';
import {
  configureTracing,
  createRedisClient,
  createServer,
  registerShutdown,
  registerTRPC,
  reportReadiness,
  sentryInit,
  startMetrics,
  TracingInstance,
} from '@hive/service-common';
import * as Sentry from '@sentry/node';
import { Context, schemaBuilderApiRouter } from './api';
import { createCache } from './cache';
import { CompositionScheduler } from './composition-scheduler';
import { env } from './environment';

async function main() {
  let tracing: TracingInstance | undefined;

  if (env.tracing.enabled && env.tracing.collectorEndpoint) {
    tracing = configureTracing({
      collectorEndpoint: env.tracing.collectorEndpoint,
      serviceName: 'schema-composition',
    });

    tracing.instrumentNodeFetch();
    tracing.setup();
  }

  if (env.sentry) {
    sentryInit({
      dist: 'schema',
      enabled: !!env.sentry,
      environment: env.environment,
      dsn: env.sentry.dsn,
      release: env.release,
    });
  }

  const server = await createServer({
    name: 'schema',
    sentryErrorHandler: true,
    warnOnMissingRequestId: true,
    log: {
      level: env.log.level,
      requests: env.log.requests,
    },
    bodyLimit: env.http.bodyLimit,
  });

  const compositionScheduler = new CompositionScheduler(
    server.log,
    env.compositionWorker.count,
    env.compositionWorker.maxOldGenerationSizeMb,
  );

  if (tracing) {
    await server.register(...tracing.instrumentFastify());
  }

  registerShutdown({
    logger: server.log,
    async onShutdown() {
      await server.close();
      redis.disconnect(false);
    },
  });

  const redis = await createRedisClient(env.redis, {
    logger: server.log.child({ source: 'Redis' }),
  });

  // Capture Redis errors in Sentry in addition to the logging done by createRedisClient
  redis.on('error', err => {
    Sentry.captureException(err);
  });

  try {
    await registerTRPC(server, {
      router: schemaBuilderApiRouter,
      createContext({ req }): Context {
        const cache = createCache({
          prefix: 'schema-service-v2',
          redis,
          logger: req.log,
          pollIntervalMs: env.timings.cachePollInterval,
          timeoutMs: env.timings.schemaCompositionTimeout,
          ttlMs: {
            success: env.timings.cacheSuccessTTL,
            failure: env.timings.cacheTTL,
          },
        });
        return { cache, req, broker: env.requestBroker, compositionScheduler };
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
        reportReadiness(true);
        void res.status(200).send();
      },
    });

    await server.listen({
      port: env.http.port,
      host: env.http.host,
      ipv6Only: env.http.ipv6Only,
    });

    if (env.prometheus) {
      await startMetrics(env.prometheus.labels.instance, {
        port: env.prometheus.port,
        host: env.http.host,
        ipv6Only: env.http.ipv6Only,
      });
    }
  } catch (error) {
    server.log.fatal(error);
    throw error;
  }
}

main().catch(err => {
  Sentry.captureException(err, {
    level: 'fatal',
  });
  console.error(err);
  process.exit(1);
});
