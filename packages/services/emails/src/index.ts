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
import { emailsApiRouter } from './api';
import type { Context } from './context';
import { env } from './environment';
import { createEmailProvider } from './providers';
import { createScheduler } from './scheduler';

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
    name: 'emails',
    tracing: false,
    log: {
      level: env.log.level,
      requests: env.log.requests,
    },
  });

  const errorHandler = createErrorHandler(server);

  try {
    const emailProvider = createEmailProvider(env.email.provider, env.email.emailFrom);
    const { schedule, readiness, start, stop } = createScheduler({
      logger: server.log,
      redis: {
        host: env.redis.host,
        port: env.redis.port,
        password: env.redis.password,
      },
      queueName: 'emails',
      emailProvider,
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
      router: emailsApiRouter,
      createContext({ req }): Context {
        return {
          req,
          errorHandler(message: string, error: Error) {
            return errorHandler(message, error, req.log);
          },
          schedule,
        };
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

    if (emailProvider.id === 'mock') {
      server.route({
        method: ['GET'],
        url: '/_history',
        handler(_, res) {
          void res.status(200).send(emailProvider.history);
        },
      });
    }

    await server.listen(env.http.port);

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
