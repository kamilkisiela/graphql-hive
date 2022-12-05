#!/usr/bin/env node
import 'reflect-metadata';
import * as Sentry from '@sentry/node';
import {
  createServer,
  startMetrics,
  registerShutdown,
  reportReadiness,
} from '@hive/service-common';
import { createConnectionString } from '@hive/storage';
import { createStripeBilling } from './billing-sync';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import { stripeBillingApiRouter, Context } from './api';
import { env } from './environment';

async function main() {
  if (env.sentry) {
    Sentry.init({
      serverName: 'stripe-billing',
      enabled: Boolean(env.sentry),
      environment: env.environment,
      dsn: env.sentry.dsn,
      release: env.release,
    });
  }

  const server = await createServer({
    name: 'stripe-billing',
    tracing: false,
    log: {
      level: env.log.level,
    },
  });

  try {
    const { readiness, start, stop, stripeApi, postgres$, loadStripeData$ } = createStripeBilling({
      logger: server.log,
      stripe: {
        token: env.stripe.secretKey,
        syncIntervalMs: env.stripe.syncIntervalMs,
      },
      rateEstimator: {
        endpoint: env.hiveServices.usageEstimator.endpoint,
      },
      storage: {
        connectionString: createConnectionString(env.postgres),
      },
    });

    registerShutdown({
      logger: server.log,
      async onShutdown() {
        await Promise.all([stop(), server.close()]);
      },
    });

    const context: Context = {
      storage$: postgres$,
      stripe: stripeApi,
      stripeData$: loadStripeData$,
    };

    await server.register(fastifyTRPCPlugin, {
      prefix: '/trpc',
      trpcOptions: {
        router: stripeBillingApiRouter,
        createContext: () => context,
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
        const isReady = readiness();
        reportReadiness(isReady);
        void res.status(isReady ? 200 : 400).send();
      },
    });

    if (env.prometheus) {
      await startMetrics(env.prometheus.labels.instance);
    }
    await server.listen(env.http.port, '0.0.0.0');
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
