#!/usr/bin/env node
import 'reflect-metadata';
import * as Sentry from '@sentry/node';
import { startMetrics, registerShutdown } from '@hive/service-common';
import { env } from './environment';
import { createLogger } from 'packages/services/service-common/src/logger';
import { estimatorContext, usageEstimatorRouter } from './router';
import { createServer } from 'http';

async function main() {
  if (env.sentry) {
    Sentry.init({
      serverName: 'usage-estimator',
      enabled: !!env.sentry,
      environment: env.environment,
      dsn: env.sentry.dsn,
      release: env.release,
    });
  }

  const logger = createLogger();

  const server = createServer(usageEstimatorRouter);

  try {
    registerShutdown({
      logger,
      async onShutdown() {
        await Promise.all([estimatorContext.stop(), server.close()]);
      },
    });

    if (env.prometheus) {
      await startMetrics(env.prometheus.labels.instance);
    }

    await estimatorContext.start();
    return new Promise<void>(resolve => {
      server.listen(env.http.port, 'localhost', resolve);
    });
  } catch (error: any) {
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
