#!/usr/bin/env node
import { createServer, createErrorHandler, ensureEnv, startMetrics, registerShutdown, reportReadiness } from '@hive/service-common';
import * as Sentry from '@sentry/node';
import type { WebhookInput } from './types';
import { createScheduler } from './scheduler';

async function main() {
  Sentry.init({
    serverName: 'schema',
    enabled: process.env.ENVIRONMENT === 'prod',
    environment: process.env.ENVIRONMENT,
    dsn: process.env.SENTRY_DSN,
    release: process.env.RELEASE || 'local',
  });

  const server = createServer({
    name: 'webhooks',
    tracing: false,
  });

  const errorHandler = createErrorHandler(server);

  try {
    const port = process.env.PORT || 6250;

    const { schedule, readiness, start, stop } = createScheduler({
      logger: server.log,
      redis: {
        host: ensureEnv('REDIS_HOST'),
        port: ensureEnv('REDIS_PORT', 'number'),
        password: ensureEnv('REDIS_PASSWORD'),
      },
      webhookQueueName: 'webhook',
      maxAttempts: 10,
      backoffDelay: 2000,
    });

    registerShutdown({
      logger: server.log,
      async onShutdown() {
        await stop();
      },
    });

    server.route<{
      Body: WebhookInput;
    }>({
      method: 'POST',
      url: '/schedule',
      async handler(req, res) {
        try {
          const job = await schedule(req.body);
          res.status(200).send({
            job: job.id ?? 'unknown',
          });
        } catch (error) {
          errorHandler('Failed to schedule a webhook', error as Error, req.log);
          res.status(500).send(error);
        }
      },
    });

    server.route({
      method: ['GET', 'HEAD'],
      url: '/_health',
      handler(req, res) {
        res.status(200).send();
      },
    });

    server.route({
      method: ['GET', 'HEAD'],
      url: '/_readiness',
      handler(_, res) {
        const isReady = readiness();
        reportReadiness(isReady);
        res.status(isReady ? 200 : 400).send();
      },
    });

    await server.listen(port, '0.0.0.0');

    if (process.env.METRICS_ENABLED === 'true') {
      await startMetrics();
    }

    await start();
  } catch (error) {
    server.log.fatal(error);
    Sentry.captureException(error, {
      level: Sentry.Severity.Fatal,
    });
    process.exit(1);
  }
}

main().catch(err => {
  Sentry.captureException(err, {
    level: Sentry.Severity.Fatal,
  });
  console.error(err);
  process.exit(1);
});
