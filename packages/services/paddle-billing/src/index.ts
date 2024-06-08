#!/usr/bin/env node
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
import * as Sentry from '@sentry/node';
import { Context, paddleBillingApiRouter } from './api';
import { createPaddleBilling } from './billing-sync';
import { env } from './environment';

async function main() {
  let tracing: TracingInstance | undefined;

  if (env.tracing.enabled && env.tracing.collectorEndpoint) {
    tracing = configureTracing({
      collectorEndpoint: env.tracing.collectorEndpoint,
      serviceName: 'paddle-billing',
    });

    tracing.instrumentNodeFetch();
    tracing.build();
    tracing.start();
  }

  if (env.sentry) {
    Sentry.init({
      serverName: hostname(),
      dist: 'paddle-billing',
      enabled: !!env.sentry,
      environment: env.environment,
      dsn: env.sentry.dsn,
      release: env.release,
    });
  }

  const server = await createServer({
    name: 'paddle-billing',
    sentryErrorHandler: true,
    log: {
      level: env.log.level,
      requests: env.log.requests,
    },
  });

  try {
    const { readiness, start, stop, paddleApi, loadPaddleData$ } = createPaddleBilling({
      logger: server.log,
      paddle: {
        apiKey: env.paddle.apiKey,
        environment: env.paddle.environment,
      },
    });

    registerShutdown({
      logger: server.log,
      async onShutdown() {
        await Promise.all([stop(), server.close()]);
      },
    });

    await registerTRPC(server, {
      router: paddleBillingApiRouter,
      createContext({ req }): Context {
        return {
          paddleData$: loadPaddleData$,
          paddle: paddleApi,
          req,
          paddleConfig: {
            webhookSecret: env.paddle.webhookSecret,
          },
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
        const isReady = await readiness();
        reportReadiness(isReady);
        void res.status(isReady ? 200 : 400).send();
      },
    });

    if (env.prometheus) {
      await startMetrics(env.prometheus.labels.instance);
    }
    await server.listen({
      port: env.http.port,
      host: '::',
    });
    await start();
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
