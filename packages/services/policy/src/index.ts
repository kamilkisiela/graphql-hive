#!/usr/bin/env node
import {
  configureTracing,
  createServer,
  registerShutdown,
  registerTRPC,
  reportReadiness,
  sentryInit,
  startMetrics,
  TracingInstance,
} from '@hive/service-common';
import * as Sentry from '@sentry/node';
import { Context, schemaPolicyApiRouter } from './api';
import { env } from './environment';

async function main() {
  let tracing: TracingInstance | undefined;

  if (env.tracing.enabled && env.tracing.collectorEndpoint) {
    tracing = configureTracing({
      collectorEndpoint: env.tracing.collectorEndpoint,
      serviceName: 'schema-policy',
    });

    tracing.instrumentNodeFetch();
    tracing.setup();
  }

  if (env.sentry) {
    sentryInit({
      dist: 'policy',
      enabled: !!env.sentry,
      environment: env.environment,
      dsn: env.sentry.dsn,
      release: env.release,
    });
  }

  const server = await createServer({
    name: 'policy',
    sentryErrorHandler: true,
    warnOnMissingRequestId: true,
    log: {
      level: env.log.level,
      requests: env.log.requests,
    },
  });

  if (tracing) {
    await server.register(...tracing.instrumentFastify());
  }

  registerShutdown({
    logger: server.log,
    async onShutdown() {
      await server.close();
    },
  });

  try {
    await registerTRPC(server, {
      router: schemaPolicyApiRouter,
      createContext({ req }): Context {
        return { req };
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
