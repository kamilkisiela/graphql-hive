#!/usr/bin/env node
import { hostname } from 'os';
import {
  createServer,
  registerShutdown,
  reportReadiness,
  startMetrics,
} from '@hive/service-common';
import * as Sentry from '@sentry/node';
import { env } from './environment';
import { maskToken } from './helpers';
import {
  collectDuration,
  droppedReports,
  httpRequests,
  httpRequestsWithNoAccess,
  httpRequestsWithNonExistingToken,
  httpRequestsWithoutToken,
  tokensDuration,
  usedAPIVersion,
} from './metrics';
import { createUsageRateLimit } from './rate-limit';
import { createTokens } from './tokens';
import { createUsage } from './usage';
import { usageProcessorV1 } from './usage-processor-1';
import { usageProcessorV2 } from './usage-processor-2';

async function main() {
  if (env.sentry) {
    Sentry.init({
      serverName: hostname(),
      dist: 'usage',
      enabled: !!env.sentry,
      environment: env.environment,
      dsn: env.sentry.dsn,
      release: env.release,
    });
  }

  const server = await createServer({
    name: 'usage',
    tracing: false,
    log: {
      level: env.log.level,
      requests: env.log.requests,
    },
  });

  try {
    const { collect, readiness, start, stop } = createUsage({
      logger: server.log,
      kafka: {
        topic: env.kafka.topic,
        buffer: env.kafka.buffer,
        connection: env.kafka.connection,
      },
      onStop(reason) {
        return shutdown(reason);
      },
    });

    const shutdown = registerShutdown({
      logger: server.log,
      async onShutdown() {
        await Promise.all([stop(), server.close()]);
      },
    });

    const tokens = createTokens({
      endpoint: env.hive.tokens.endpoint,
      logger: server.log,
    });

    const rateLimit = env.hive.rateLimit
      ? createUsageRateLimit({
          endpoint: env.hive.rateLimit.endpoint,
          logger: server.log,
        })
      : null;

    server.route<{
      Body: unknown;
    }>({
      method: 'POST',
      url: '/',
      async handler(req, res) {
        httpRequests.inc();
        let token: string | undefined;
        const legacyToken = req.headers['x-api-token'] as string;
        const apiVersion = Array.isArray(req.headers['x-usage-api-version'])
          ? req.headers['x-usage-api-version'][0]
          : req.headers['x-usage-api-version'];

        if (apiVersion) {
          if (apiVersion === '1') {
            usedAPIVersion.labels({ version: '1' }).inc();
          } else if (apiVersion === '2') {
            usedAPIVersion.labels({ version: '2' }).inc();
          }
          usedAPIVersion.labels({ version: 'invalid' }).inc();
        } else {
          usedAPIVersion.labels({ version: 'none' }).inc();
        }

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
          void res.status(401).send('Missing token');
          httpRequestsWithoutToken.inc();
          return;
        }

        if (token.length !== 32) {
          void res.status(401).send('Invalid token');
          httpRequestsWithoutToken.inc();
          return;
        }

        const stopTokensDurationTimer = tokensDuration.startTimer();
        const tokenInfo = await tokens.fetch(token);
        const maskedToken = maskToken(token);

        if (tokens.isNotFound(tokenInfo)) {
          stopTokensDurationTimer({
            status: 'not_found',
          });
          httpRequestsWithNonExistingToken.inc();
          req.log.info('Token not found (token=%s)', maskedToken);
          void res.status(401).send('Missing token');
          return;
        }

        // We treat collected operations as part of registry
        if (tokens.isNoAccess(tokenInfo)) {
          stopTokensDurationTimer({
            status: 'no_access',
          });
          httpRequestsWithNoAccess.inc();
          req.log.info('No access (token=%s)', maskedToken);
          void res.status(403).send('No access');
          return;
        }

        stopTokensDurationTimer({
          status: 'success',
        });

        if (
          await rateLimit?.isRateLimited({
            id: tokenInfo.target,
            type: 'operations-reporting',
            token,
            entityType: 'target',
          })
        ) {
          droppedReports
            .labels({ targetId: tokenInfo.target, orgId: tokenInfo.organization })
            .inc();
          req.log.info('Rate limited (token=%s)', maskedToken);
          void res.status(429).send();

          return;
        }

        const retentionInfo =
          (await rateLimit?.getRetentionForTargetId?.(tokenInfo.target)) || null;

        const stopTimer = collectDuration.startTimer();
        try {
          if (readiness() === false) {
            req.log.warn('Not ready to collect report (token=%s)', maskedToken);
            stopTimer({
              status: 'not_ready',
            });
            // 503 - Service Unavailable
            // The server is currently unable to handle the request due being not ready.
            // This tells the gateway to retry the request and not to drop it.
            void res.status(503).send();
            return;
          }

          if (apiVersion === undefined || apiVersion === '1') {
            const result = usageProcessorV1(server.log, req.body as any, tokenInfo, retentionInfo);
            collect(result.report);
            stopTimer({
              status: 'success',
            });
            void res.status(200).send({
              id: result.report.id,
              operations: result.operations,
            });
          } else if (apiVersion === '2') {
            const result = usageProcessorV2(server.log, req.body, tokenInfo, retentionInfo);

            if (result.success === false) {
              stopTimer({
                status: 'error',
              });
              void res.status(400).send({
                errors: result.errors,
              });
              return;
            }

            collect(result.report);
            stopTimer({
              status: 'success',
            });
            void res.status(200).send({
              id: result.report.id,
              operations: result.operations,
            });
          } else {
            stopTimer({
              status: 'error',
            });
            void res.status(401).send("Invalid 'x-api-version' header value.");
          }
        } catch (error) {
          stopTimer({
            status: 'error',
          });
          req.log.error('Failed to collect report (token=%s)', maskedToken);
          req.log.error(error, 'Failed to collect');
          Sentry.captureException(error, {
            level: 'error',
          });
          void res.status(500).send();
        }
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
        const isReady = readiness();
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
  }
}

main().catch(err => {
  Sentry.captureException(err, {
    level: 'fatal',
  });
  console.error(err);
  process.exit(1);
});
