#!/usr/bin/env node
import Redis from 'ioredis';
import { createPool, sql } from 'slonik';
import {
  createServer,
  registerShutdown,
  reportReadiness,
  startHeartbeats,
  startMetrics,
} from '@hive/service-common';
import * as Sentry from '@sentry/node';
import { env } from './environment';
import { PersistedDocumentsWorker } from './persisted-documents-worker';

const clientCommandMessageReg = /ERR unknown command ['`]\s*client\s*['`]/;

function createPostgresConnectionString(config: {
  host: string;
  port: number;
  password: string;
  user: string;
  db: string;
  ssl: boolean;
}) {
  // prettier-ignore
  return `postgres://${config.user}:${config.password}@${config.host}:${config.port}/${config.db}${config.ssl ? '?sslmode=require' : '?sslmode=disable'}`;
}

async function main() {
  if (env.sentry) {
    Sentry.init({
      serverName: 'emails',
      enabled: !!env.sentry,
      environment: env.environment,
      dsn: env.sentry.dsn,
      release: env.release,
    });
  }

  const server = await createServer({
    name: 'persisted-documents',
    tracing: false,
    log: {
      level: env.log.level,
      requests: env.log.requests,
    },
  });

  function onError(source: string) {
    return (error: Error) => {
      server.log.error(`onError called from source ${source}`, error);
      Sentry.captureException(error, {
        extra: {
          error,
          source,
        },
        level: 'error',
      });
    };
  }

  async function runReadinessCheck() {
    await Promise.all([pgPool.any(sql`SELECT 1`), redis.ping()]);
    return true;
  }

  server.route({
    method: ['GET', 'HEAD'],
    url: '/_health',
    handler(req, res) {
      void res.status(200).send();
    },
  });

  server.route({
    method: ['GET', 'HEAD'],
    url: '/_readiness',
    async handler(_, res) {
      const isReady = await runReadinessCheck();
      reportReadiness(isReady);
      void res.status(isReady ? 200 : 400).send();
    },
  });

  const stopHeartbeats = env.heartbeat
    ? startHeartbeats({
        enabled: true,
        endpoint: env.heartbeat.endpoint,
        intervalInMS: 20_000,
        onError: e => server.log.error(e, `Heartbeat failed with error`),
        isReady: runReadinessCheck,
      })
    : startHeartbeats({ enabled: false });

  registerShutdown({
    logger: server.log,
    async onShutdown() {
      await server.close();
      stopHeartbeats();
      await stopWorker();
      await Promise.all([pgPool.end(), redis.quit()]);
    },
  });

  if (env.prometheus) {
    await startMetrics(env.prometheus.labels.instance);
  }

  const pgPool = await createPool(createPostgresConnectionString(env.postgres));
  const redis = new Redis({
    host: env.redis.host,
    port: env.redis.port,
    password: env.redis.password,
    retryStrategy(times) {
      return Math.min(times * 500, 2000);
    },
    reconnectOnError(error) {
      onError('redis:reconnectOnError')(error);
      if (clientCommandMessageReg.test(error.message)) {
        return false;
      }
      return 1;
    },
    db: 0,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });

  redis.on('error', err => {
    onError('redis:error')(err);
  });

  redis.on('connect', () => {
    server.log.info('Redis connection established');
  });

  redis.on('close', () => {
    server.log.info('Redis connection closed');
  });

  redis.on('reconnecting', (timeToReconnect?: number) => {
    server.log.info('Redis reconnecting in %s', timeToReconnect);
  });

  redis.on('end', async () => {
    server.log.info('Redis ended - no more reconnections will be made');
  });

  await new Promise<void>(res => {
    redis.once('ready', async () => {
      server.log.info('Redis connection ready... creating worker...');
      res();
    });
  });

  const worker = new PersistedDocumentsWorker(
    env.s3,
    pgPool,
    redis,
    server.log,
    onError('persisted-documents-worker'),
  );

  await worker.start();

  server.log.info('Worker is ready and started.');

  const stopWorker = await worker.start();
  await server.listen(env.http.port);
}

main().catch(err => {
  Sentry.captureException(err, {
    level: 'fatal',
  });
  console.error(err);
  process.exit(1);
});
