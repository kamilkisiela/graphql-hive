#!/usr/bin/env node
import { createServer } from 'http';
import {
  createLogger,
  registerShutdown,
  startHeartbeats,
  startMetrics,
} from '@hive/service-common';
import * as Sentry from '@sentry/node';
import { env } from './environment';
import { schedularReadiness, startSchedular, stopSchedular, webhooksRouter } from './router';

async function main() {
  if (env.sentry) {
    Sentry.init({
      serverName: 'webhooks',
      enabled: !!env.sentry,
      environment: env.environment,
      dsn: env.sentry.dsn,
      release: env.release,
    });
  }

  const logger = createLogger(env.log.level);

  try {
    const stopHeartbeats = env.heartbeat
      ? startHeartbeats({
          enabled: true,
          endpoint: env.heartbeat.endpoint,
          intervalInMS: 20_000,
          onError: e => logger.error(e, `Heartbeat failed with error`),
          isReady: schedularReadiness,
        })
      : startHeartbeats({ enabled: false });

    registerShutdown({
      logger,
      async onShutdown() {
        stopHeartbeats();
        await stopSchedular();
      },
    });

    const server = createServer(webhooksRouter);

    if (env.prometheus) {
      await startMetrics(env.prometheus.labels.instance);
    }

    await startSchedular();
    return new Promise<void>(resolve => {
      server.listen(env.http.port, 'localhost', resolve);
    });
  } catch (error) {
    logger.error(error);
    Sentry.captureException(error, {
      level: 'fatal',
    });
    process.exit(1);
  }
}

main().catch(err => {
  Sentry.captureException(err, {
    level: 'fatal',
  });
  console.error(err);
  process.exit(1);
});
