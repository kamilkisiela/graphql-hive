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
  droppedReports,
} from './metrics';
import type { IncomingLegacyReport, IncomingReport } from './types';
import { createUsageRateLimit } from './rate-limit';
import { maskToken } from './helpers';

async function main() {
  Sentry.init({
    serverName: 'usage',
    enabled: String(process.env.SENTRY_ENABLED) === '1',
    environment: process.env.ENVIRONMENT,
    dsn: process.env.SENTRY_DSN,
    release: process.env.RELEASE || 'local',
  });

  const server = await createServer({
    name: 'usage',
    tracing: false,
  });

  try {
    const { collect, readiness, start, stop } = createUsage({
      logger: server.log,
      kafka: {
        topic: ensureEnv('KAFKA_TOPIC'),
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
        let token: string | undefined;
        const legacyToken = req.headers['x-api-token'] as string;

        if (legacyToken) {
          // TODO: add metrics to track legacy x-api-token header
          token = legacyToken;
        } else {
          const authValue = req.headers.authorization;

          if (authValue) {
            token = authValue.replace(/^Bearer\s+/, '');
          }
        }

        if (!token) {
          res.status(400).send('Missing token'); // eslint-disable-line @typescript-eslint/no-floating-promises -- false positive, FastifyReply.then returns void
          httpRequestsWithoutToken.inc();
          return;
        }

        const tokenInfo = await tokens.fetch(token);

        const maskedToken = maskToken(token);

        if (tokens.isNotFound(tokenInfo)) {
          httpRequestsWithNonExistingToken.inc();
          req.log.info('Token not found (token=%s)', maskedToken);
          res.status(400).send('Missing token'); // eslint-disable-line @typescript-eslint/no-floating-promises -- false positive, FastifyReply.then returns void
          return;
        }

        // We treat collected operations as part of registry
        if (tokens.isNoAccess(tokenInfo)) {
          httpRequestsWithNoAccess.inc();
          req.log.info('No access (token=%s)', maskedToken);
          res.status(403).send('No access'); // eslint-disable-line @typescript-eslint/no-floating-promises -- false positive, FastifyReply.then returns void
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
          droppedReports.labels({ targetId: tokenInfo.target }).inc();
          req.log.info('Rate limited (token=%s)', maskedToken);
          res.status(429).send(); // eslint-disable-line @typescript-eslint/no-floating-promises -- false positive, FastifyReply.then returns void

          return;
        }

        const retentionInfo = (await rateLimit?.getRetentionForTargetId?.(tokenInfo.target)) || null;

        const stopTimer = collectLatency.startTimer();
        try {
          await collect(req.body, tokenInfo, retentionInfo);
          stopTimer();
          res.status(200).send(); // eslint-disable-line @typescript-eslint/no-floating-promises -- false positive, FastifyReply.then returns void
        } catch (error) {
          stopTimer();
          req.log.error('Failed to collect report (token=%s)', maskedToken);
          req.log.error(error, 'Failed to collect');
          Sentry.captureException(error, {
            level: 'error',
          });
          res.status(500).send(); // eslint-disable-line @typescript-eslint/no-floating-promises -- false positive, FastifyReply.then returns void
        }
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
        const isReady = readiness();
        reportReadiness(isReady);
        res.status(isReady ? 200 : 400).send(); // eslint-disable-line @typescript-eslint/no-floating-promises -- false positive, FastifyReply.then returns void
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
      level: 'fatal',
    });
  }
}

main().catch(err => {
  Sentry.captureException(err, {
    level: 'fatal',
  });
  console.error(err);
  process.exit(1);
});
