#!/usr/bin/env node
import {
  createServer,
  createErrorHandler,
  startMetrics,
  registerShutdown,
} from '@the-guild-org/hive-service-common';
import * as Sentry from '@sentry/node';
import type { SchemaCheckInput } from './types';
import { policyCheckCounter } from './metrics';
import { schemaPolicyCheck } from './schema-check';

async function main() {
  Sentry.init({
    serverName: 'policy',
    enabled: process.env.ENVIRONMENT === 'prod',
    environment: process.env.ENVIRONMENT,
    dsn: process.env.SENTRY_DSN,
    release: process.env.RELEASE || 'local',
  });

  const server = createServer({
    tracing: false,
  });

  registerShutdown({
    logger: server.log,
    async onShutdown() {
      await server.close();
    },
  });

  const errorHandler = createErrorHandler(server);

  try {
    const port = process.env.PORT || 6600;

    server.route<{
      Body: {
        input: SchemaCheckInput;
      };
    }>({
      method: 'POST',
      url: '/schema-check',
      async handler(req, res) {
        policyCheckCounter.labels({}).inc();
        try {
          if (!req.body?.input?.policy || !req.body?.input?.source) {
            return res.status(400).send({
              error: 'Invalid input',
            });
          }

          const result = await schemaPolicyCheck({
            policy: req.body.input.policy,
            sdl: req.body.input.source,
          });
          res.status(200).send(result);
        } catch (error) {
          errorHandler('Failed to execute policy', error as Error, req.log);
          res.status(500).send(error);
        }
      },
    });

    server.route({
      method: ['GET', 'HEAD'],
      url: '/_health',
      handler(_, res) {
        res.status(200).send();
      },
    });

    server.route({
      method: ['GET', 'HEAD'],
      url: '/_readiness',
      handler(_, res) {
        res.status(200).send();
      },
    });

    await server.listen(port, '0.0.0.0');
    if (process.env.METRICS_ENABLED === 'true') {
      await startMetrics();
    }
  } catch (error) {
    server.log.fatal(error);
    throw error;
  }
}

main().catch((err) => {
  Sentry.captureException(err, {
    level: Sentry.Severity.Fatal,
  });
  console.error(err);
  process.exit(1);
});
