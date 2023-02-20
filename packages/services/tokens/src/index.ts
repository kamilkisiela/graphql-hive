#!/usr/bin/env node
import 'reflect-metadata';
import {
  createLogger,
  registerShutdown,
  startHeartbeats,
  startMetrics,
} from '@hive/service-common';
import * as Sentry from '@sentry/node';
import { env } from './environment';
import { cacheReadiness, redisInstance, startCache, stopCache, tokensRouter } from './router'
import { createServer } from 'http'

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

  const logger = createLogger();

  const server =  createServer(tokensRouter);

  const stopHeartbeats = env.heartbeat
    ? startHeartbeats({
        enabled: true,
        endpoint: env.heartbeat.endpoint,
        intervalInMS: 20_000,
        onError: e => logger.error(e, `Heartbeat failed with error`),
        isReady: cacheReadiness,
      })
    : startHeartbeats({ enabled: false });

  async function shutdown() {
    stopHeartbeats();
    server.close();
    await stopCache();
  }

  try {
    redisInstance.on('error', err => {
      logger.error(err, 'Redis connection error');
    });

    redisInstance.on('connect', () => {
      logger.info('Redis connection established');
    });

    redisInstance.on('ready', () => {
      logger.info('Redis connection ready... ');
    });

    redisInstance.on('close', () => {
      logger.info('Redis connection closed');
    });

    redisInstance.on('reconnecting', timeToReconnect => {
      logger.info('Redis reconnecting in %s', timeToReconnect);
    });

    redisInstance.on('end', async () => {
      logger.info('Redis ended - no more reconnections will be made');
      await shutdown();
    });

    registerShutdown({
      logger,
      onShutdown: shutdown,
    });

    if (env.prometheus) {
      await startMetrics(env.prometheus.labels.instance);
    }
    await startCache();
    return new Promise<void>(resolve => {
      server.listen(env.http.port, 'localhost', resolve);
    });
  } catch (error) {
    logger.fatal(error as string);
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