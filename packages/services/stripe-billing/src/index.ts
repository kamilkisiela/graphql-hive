#!/usr/bin/env node
import { createServerAdapter } from '@whatwg-node/server';
import 'reflect-metadata';
import * as Sentry from '@sentry/node';
import {
  startMetrics,
  registerShutdown,
  createLogger,
  FastifyLoggerInstance,
} from '@hive/service-common';
import { env } from './environment';
import { createServer } from 'http';
import { startStripeBilling, stopStripeBilling, stripeBillingRouter } from './router';

async function main() {
  if (env.sentry) {
    Sentry.init({
      serverName: 'stripe-billing',
      enabled: !!env.sentry,
      environment: env.environment,
      dsn: env.sentry.dsn,
      release: env.release,
    });
  }

  const logger = createLogger() as FastifyLoggerInstance;

  const app = createServerAdapter(stripeBillingRouter);
  const server = createServer(app);

  try {
    registerShutdown({
      logger,
      async onShutdown() {
        await Promise.all([stopStripeBilling(), server.close()]);
      },
    });

    if (env.prometheus) {
      await startMetrics(env.prometheus.labels.instance);
    }
    await startStripeBilling();
    return new Promise<void>(resolve => {
      server.listen(env.http.port, '0.0.0.0', resolve);
    });
  } catch (error) {
    logger.fatal(error);
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
