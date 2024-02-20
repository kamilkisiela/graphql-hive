#!/usr/bin/env node
import crypto from 'crypto';
import { hostname } from 'os';
import Redis from 'ioredis';
import {
  createErrorHandler,
  createServer,
  registerShutdown,
  registerTRPC,
  reportReadiness,
  startMetrics,
} from '@hive/service-common';
import * as Sentry from '@sentry/node';
import { Context, schemaBuilderApiRouter } from './api';
import { createCache } from './cache';
import { env } from './environment';

const ENCRYPTION_SECRET = crypto.createHash('md5').update(env.encryptionSecret).digest('hex');

function decryptFactory() {
  const ALG = 'aes256';
  const IN_ENC = 'utf8';
  const OUT_ENC = 'hex';

  const secretBuffer = Buffer.from(ENCRYPTION_SECRET, 'latin1');

  return function decrypt(text: string) {
    const components = text.split(':');
    const iv = Buffer.from(components.shift() || '', OUT_ENC);
    const decipher = crypto.createDecipheriv(ALG, secretBuffer, iv);

    return decipher.update(components.join(':'), OUT_ENC, IN_ENC) + decipher.final(IN_ENC);
  };
}

async function main() {
  if (env.sentry) {
    Sentry.init({
      serverName: hostname(),
      dist: 'schema',
      enabled: !!env.sentry,
      environment: env.environment,
      dsn: env.sentry.dsn,
      release: env.release,
    });
  }

  const server = await createServer({
    name: 'schema',
    tracing: false,
    log: {
      level: env.log.level,
      requests: env.log.requests,
    },
    bodyLimit: env.http.bodyLimit,
  });

  registerShutdown({
    logger: server.log,
    async onShutdown() {
      await server.close();
      redis.disconnect(false);
    },
  });

  const errorHandler = createErrorHandler(server);

  const redis = new Redis({
    host: env.redis.host,
    port: env.redis.port,
    password: env.redis.password,
    retryStrategy(times) {
      return Math.min(times * 500, 2000);
    },
    reconnectOnError(error) {
      server.log.warn('Redis reconnectOnError (error=%s)', error);
      return 1;
    },
    db: 0,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });

  try {
    redis.on('error', err => {
      errorHandler('Redis error', err);
    });

    redis.on('connect', () => {
      server.log.debug('Redis connection established');
    });

    redis.on('ready', () => {
      server.log.info('Redis connection ready');
    });

    redis.on('close', () => {
      server.log.info('Redis connection closed');
    });

    redis.on('reconnecting', (timeToReconnect?: number) => {
      server.log.info('Redis reconnecting in %s', timeToReconnect);
    });

    const decrypt = decryptFactory();

    await registerTRPC(server, {
      router: schemaBuilderApiRouter,
      createContext({ req }): Context {
        const cache = createCache({
          prefix: 'schema-service',
          redis,
          logger: req.log,
          pollIntervalMs: env.timings.cachePollInterval,
          timeoutMs: env.timings.schemaCompositionTimeout,
          ttlMs: {
            success: env.timings.cacheSuccessTTL,
            failure: env.timings.cacheTTL,
          },
        });
        return { cache, req, decrypt, broker: env.requestBroker };
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

    await server.listen(env.http.port, '::');
    if (env.prometheus) {
      await startMetrics(env.prometheus.labels.instance, env.prometheus.port);
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
