#!/usr/bin/env node
import * as Sentry from '@sentry/node';
import { createServer, startMetrics, ensureEnv, registerShutdown, reportReadiness } from '@hive/service-common';
import { createTokens } from './tokens';
import { createUsage } from './usage';
import {
  httpRequests,
  httpRequestsWithoutToken,
  httpRequestsWithNonExistingToken,
  httpRequestsWithNoAccess,
  collectLatency,
} from './metrics';
import type { IncomingLegacyReport, IncomingReport } from './types';
import { createUsageRateLimit } from './rate-limit';

async function main() {
  Sentry.init({
    serverName: 'usage',
    enabled: process.env.ENVIRONMENT === 'prod',
    environment: process.env.ENVIRONMENT,
    dsn: process.env.SENTRY_DSN,
    release: process.env.RELEASE || 'local',
  });

  const server = createServer({
    name: 'usage',
    tracing: false,
  });

  try {
    const { collect, readiness, start, stop } = createUsage({
      logger: server.log,
      kafka: {
        topic: 'usage_reports_v2',
        buffer: {
          size: ensureEnv('KAFKA_BUFFER_SIZE', 'number'),
          interval: ensureEnv('KAFKA_BUFFER_INTERVAL', 'number'),
          dynamic: ensureEnv('KAFKA_BUFFER_DYNAMIC', 'boolean'),
        },
        connection:
          ensureEnv('KAFKA_CONNECTION_MODE') == 'hosted'
            ? {
                mode: 'hosted',
                key: ensureEnv('KAFKA_KEY'),
                user: ensureEnv('KAFKA_USER'),
                broker: ensureEnv('KAFKA_BROKER'),
              }
            : {
                mode: 'docker',
                broker: ensureEnv('KAFKA_BROKER'),
              },
      },
    });

    registerShutdown({
      logger: server.log,
      async onShutdown() {
        await Promise.all([stop(), server.close()]);
      },
    });

    const port = process.env.PORT || 5000;

    const tokens = createTokens({
      endpoint: ensureEnv('TOKENS_ENDPOINT'),
      logger: server.log,
    });

    const rateLimit = process.env.RATE_LIMIT_ENDPOINT
      ? createUsageRateLimit({
          endpoint: ensureEnv('RATE_LIMIT_ENDPOINT'),
          logger: server.log,
        })
      : null;

    server.route<{
      Body: IncomingReport | IncomingLegacyReport;
    }>({
      method: 'POST',
      url: '/',
      async handler(req, res) {
        httpRequests.inc();
        const token = req.headers['x-api-token'] as string;

        if (!token) {
          res.status(400).send('Missing token');
          httpRequestsWithoutToken.inc();
          return;
        }

        const tokenInfo = await tokens.fetch(token);

        if (tokens.isNotFound(tokenInfo)) {
          httpRequestsWithNonExistingToken.inc();
          res.status(400).send('Missing token');
          return;
        }

        // We treat collected operations as part of registry
        if (tokens.isNoAccess(tokenInfo)) {
          httpRequestsWithNoAccess.inc();
          server.log.info(`No access`);
          res.status(403).send('No access');
          return;
        }

        if (
          await rateLimit?.isRateLimited({
            id: tokenInfo.target,
            type: 'operations-reporting',
            token,
            entityType: 'target',
          })
        ) {
          // TODO: We should trigger a call to update the KV in the WAF in case we want to make sure token is being blocked?
          res.status(429).send();

          return;
        }

        const retentionInfo = (await rateLimit?.getRetentionForTargetId?.(tokenInfo.target)) || null;

        const stopTimer = collectLatency.startTimer();
        try {
          await collect(req.body, tokenInfo, retentionInfo);
          stopTimer();
          res.status(200).send();
        } catch (error) {
          stopTimer();
          req.log.error(error, 'Failed to collect');
          Sentry.captureException(error, {
            level: Sentry.Severity.Error,
          });
          res.status(500).send();
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
        const isReady = readiness();
        reportReadiness(isReady);
        res.status(isReady ? 200 : 400).send();
      },
    });

    if (process.env.METRICS_ENABLED === 'true') {
      await startMetrics();
    }
    await server.listen(port, '0.0.0.0');
    await start();
  } catch (error) {
    server.log.fatal(error);
    Sentry.captureException(error, {
      level: Sentry.Severity.Fatal,
    });
  }
}

main().catch(err => {
  Sentry.captureException(err, {
    level: Sentry.Severity.Fatal,
  });
  console.error(err);
  process.exit(1);
});
