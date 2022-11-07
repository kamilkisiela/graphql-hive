#!/usr/bin/env node
import {
  createServer,
  createErrorHandler,
  startMetrics,
  registerShutdown,
  reportReadiness,
} from '@hive/service-common';
import * as Sentry from '@sentry/node';
import Redis from 'ioredis';
import crypto from 'crypto';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify/dist/trpc-server-adapters-fastify.cjs.js';
import type { CreateFastifyContextOptions } from '@trpc/server/adapters/fastify';
import { schemaBuilderApiRouter } from './api';
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
      serverName: 'schema',
      enabled: !!env.sentry,
      environment: env.environment,
      dsn: env.sentry.dsn,
      release: env.release,
    });
  }

  const server = await createServer({
    name: 'schema',
    tracing: false,
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
      server.log.warn('Redis reconnectOnError', error);
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

    redis.on('reconnecting', timeToReconnect => {
      server.log.info('Redis reconnecting in %s', timeToReconnect);
    });

    const decrypt = decryptFactory();

    await server.register(fastifyTRPCPlugin, {
      prefix: '/trpc',
      trpcOptions: {
        router: schemaBuilderApiRouter,
        createContext({ req }: CreateFastifyContextOptions) {
          return { redis, logger: req.log, decrypt, broker: env.requestBroker };
        },
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
        reportReadiness(true);
        res.status(200).send(); // eslint-disable-line @typescript-eslint/no-floating-promises -- false positive, FastifyReply.then returns void
      },
    });

    await server.listen(env.http.port, '0.0.0.0');
    if (env.prometheus) {
      await startMetrics(env.prometheus.labels.instance);
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
