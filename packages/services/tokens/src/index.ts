#!/usr/bin/env node
import Redis from 'ioredis';
import ms from 'ms';
import 'reflect-metadata';
import { hostname } from 'os';
import LRU from 'tiny-lru';
import {
  createErrorHandler,
  createServer,
  registerShutdown,
  registerTRPC,
  reportReadiness,
  startHeartbeats,
  startMetrics,
} from '@hive/service-common';
import * as Sentry from '@sentry/node';
import { Context, tokensApiRouter } from './api';
import { useCache } from './cache';
import { env } from './environment';
import { createStorage } from './storage';

export async function main() {
  if (env.sentry) {
    Sentry.init({
      dist: 'tokens',
      serverName: hostname(),
      enabled: true,
      environment: env.environment,
      dsn: env.sentry.dsn,
      release: env.release,
    });
  }

  const server = await createServer({
    name: 'tokens',
    tracing: false,
    log: {
      level: env.log.level,
      requests: env.log.requests,
    },
  });

  const errorHandler = createErrorHandler(server);

  const redis = new Redis({
    host: env.redis.host,
    port: env.redis.port,
    password: env.redis.password,
    maxRetriesPerRequest: 20,
    db: 0,
    enableReadyCheck: false,
  });

  const { start, stop, readiness, getStorage } = useCache(
    createStorage(env.postgres),
    redis,
    server.log,
  );

  const stopHeartbeats = env.heartbeat
    ? startHeartbeats({
        enabled: true,
        endpoint: env.heartbeat.endpoint,
        intervalInMS: 20_000,
        onError: e => server.log.error(e, `Heartbeat failed with error`),
        isReady: readiness,
      })
    : startHeartbeats({ enabled: false });

  async function shutdown() {
    stopHeartbeats();
    await server.close();
    await stop();
  }

  try {
    redis.on('error', err => {
      server.log.error(err, 'Redis connection error');
    });

    redis.on('connect', () => {
      server.log.info('Redis connection established');
    });

    redis.on('ready', () => {
      server.log.info('Redis connection ready... ');
    });

    redis.on('close', () => {
      server.log.info('Redis connection closed');
    });

    redis.on('reconnecting', (timeToReconnect?: number) => {
      server.log.info('Redis reconnecting in %s', timeToReconnect);
    });

    redis.on('end', async () => {
      server.log.info('Redis ended - no more reconnections will be made');
      await shutdown();
    });

    // Cache failures for 1 minute
    const errorCachingInterval = ms('1m');
    const tokenReadFailuresCache = LRU<string>(1000, errorCachingInterval);

    registerShutdown({
      logger: server.log,
      onShutdown: shutdown,
    });

    await registerTRPC(server, {
      router: tokensApiRouter,
      createContext({ req }): Context {
        return {
          req,
          errorHandler,
          getStorage,
          tokenReadFailuresCache,
        };
      },
    });

    server.route({
      method: ['GET', 'HEAD'],
      url: '/_health',
      handler(_req, res) {
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
      await startMetrics(env.prometheus.labels.instance, env.prometheus.port);
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
