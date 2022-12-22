#!/usr/bin/env node
import { createServerAdapter } from '@whatwg-node/server';
import 'reflect-metadata';
import {
  startMetrics,
  registerShutdown,
  startHeartbeats,
  FastifyLoggerInstance,
  createLogger,
} from '@hive/service-common';
import * as Sentry from '@sentry/node';
import { env } from './environment';
import { createServer } from 'http';
import { cacheReadiness, startCache, stopCache, tokensRouter } from './router';

export async function main() {
  if (env.sentry) {
    Sentry.init({
      serverName: 'tokens',
      enabled: true,
      environment: env.environment,
      dsn: env.sentry.dsn,
      release: env.release,
    });
  }

  const logger = createLogger() as FastifyLoggerInstance;

  const app = createServerAdapter(tokensRouter);
  const server = createServer(app);

  try {
    const stopHeartbeats = env.heartbeat
      ? startHeartbeats({
          enabled: true,
          endpoint: env.heartbeat.endpoint,
          intervalInMS: 20_000,
          onError: logger.error,
          isReady: cacheReadiness,
        })
      : startHeartbeats({ enabled: false });

    registerShutdown({
      logger,
      async onShutdown() {
        stopHeartbeats();
        server.close();
        await stopCache();
      },
    });

    if (env.prometheus) {
      await startMetrics(env.prometheus.labels.instance);
    }
    await startCache();
    return new Promise<void>(resolve => {
      server.listen(env.http.port, '0.0.0.0', resolve);
    });
  } catch (error) {
    logger.fatal(error);
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
