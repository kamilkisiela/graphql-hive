#!/usr/bin/env node
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
import { webhooksApiRouter } from './api';
import { env } from './environment';
import { createScheduler } from './scheduler';
import type { Context } from './types';

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

  const server = await createServer({
    name: 'webhooks',
    tracing: false,
    log: {
      level: env.log.level,
      requests: env.log.requests,
    },
  });

  const errorHandler = createErrorHandler(server);

  try {
    const { schedule, readiness, start, stop } = createScheduler({
      logger: server.log,
      redis: {
        host: env.redis.host,
        port: env.redis.port,
        password: env.redis.password,
      },
      webhookQueueName: 'webhook',
      maxAttempts: 10,
      backoffDelay: 2000,
      requestBroker: env.requestBroker,
    });

    const stopHeartbeats = env.heartbeat
      ? startHeartbeats({
          enabled: true,
          endpoint: env.heartbeat.endpoint,
          intervalInMS: 20_000,
          onError: e => server.log.error(e, `Heartbeat failed with error`),
          isReady: readiness,
        })
      : startHeartbeats({ enabled: false });

    registerShutdown({
      logger: server.log,
      async onShutdown() {
        stopHeartbeats();
        await stop();
      },
    });

    await registerTRPC(server, {
      router: webhooksApiRouter,
      createContext({ req }): Context {
        return { req, errorHandler, schedule };
      },
    });

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
      handler(_, res) {
        const isReady = readiness();
        reportReadiness(isReady);
        void res.status(isReady ? 200 : 400).send();
      },
    });

    await server.listen(env.http.port, '0.0.0.0');

    if (env.prometheus) {
      await startMetrics(env.prometheus.labels.instance);
    }

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
