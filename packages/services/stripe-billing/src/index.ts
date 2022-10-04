#!/usr/bin/env node
import 'reflect-metadata';
import * as Sentry from '@sentry/node';
import { createServer, startMetrics, ensureEnv, registerShutdown, reportReadiness } from '@hive/service-common';
import { createConnectionString } from '@hive/storage';
import { createStripeBilling } from './billing-sync';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify/dist/trpc-server-adapters-fastify.cjs.js';
import { stripeBillingApiRouter, Context } from './api';

const STRIPE_SYNC_INTERVAL_MS = process.env.STRIPE_SYNC_INTERVAL_MS
  ? parseInt(process.env.STRIPE_SYNC_INTERVAL_MS as string)
  : 10 * 60_000; // default is every 10m

async function main() {
  Sentry.init({
    serverName: 'stripe-billing',
    enabled: String(process.env.SENTRY_ENABLED) === '1',
    environment: process.env.ENVIRONMENT,
    dsn: process.env.SENTRY_DSN,
    release: process.env.RELEASE || 'local',
  });

  const server = await createServer({
    name: 'stripe-billing',
    tracing: false,
  });

  try {
    const { readiness, start, stop, stripeApi, postgres$, loadStripeData$ } = createStripeBilling({
      logger: server.log,
      stripe: {
        token: ensureEnv('STRIPE_SECRET_KEY', 'string'),
        syncIntervalMs: STRIPE_SYNC_INTERVAL_MS,
      },
      rateEstimator: {
        endpoint: ensureEnv('USAGE_ESTIMATOR_ENDPOINT', 'string'),
      },
      storage: {
        connectionString: createConnectionString(process.env as any),
      },
    });

    registerShutdown({
      logger: server.log,
      async onShutdown() {
        await Promise.all([stop(), server.close()]);
      },
    });

    const port = process.env.PORT || 4013;

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
        res.status(200).send(); // eslint-disable-line @typescript-eslint/no-floating-promises -- false positive, FastifyReply.then returns void
      },
    });

    server.route({
      method: ['GET', 'HEAD'],
      url: '/_readiness',
      handler(_, res) {
        const isReady = readiness();
        reportReadiness(isReady);
        res.status(isReady ? 200 : 400).send(); // eslint-disable-line @typescript-eslint/no-floating-promises -- false positive, FastifyReply.then returns void
      },
    });

    if (process.env.METRICS_ENABLED === 'true') {
      await startMetrics();
    }
    await server.listen(port, '0.0.0.0');
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
