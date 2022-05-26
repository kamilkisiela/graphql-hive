#!/usr/bin/env node
import * as Sentry from '@sentry/node';
import { createServer, startMetrics, ensureEnv, registerShutdown, reportReadiness } from '@hive/service-common';
import { createIngestor } from './ingestor';

async function main() {
  Sentry.init({
    serverName: 'usage-ingestor',
    enabled: process.env.ENVIRONMENT === 'prod',
    environment: process.env.ENVIRONMENT,
    dsn: process.env.SENTRY_DSN,
    release: process.env.RELEASE || 'local',
  });

  const server = createServer({
    name: 'usage-ingestor',
    tracing: false,
  });

  try {
    const { readiness, start, stop } = createIngestor({
      logger: server.log,
      clickhouse: {
        protocol: ensureEnv('CLICKHOUSE_PROTOCOL'),
        host: ensureEnv('CLICKHOUSE_HOST'),
        port: ensureEnv('CLICKHOUSE_PORT', 'number'),
        username: ensureEnv('CLICKHOUSE_USERNAME'),
        password: ensureEnv('CLICKHOUSE_PASSWORD'),
      },
      kafka: {
        topic: 'usage_reports_v2',
        concurrency: ensureEnv('KAFKA_CONCURRENCY', 'number'),
        connection:
          ensureEnv('KAFKA_CONNECTION_MODE') == 'hosted'
            ? {
                mode: 'hosted',
                user: ensureEnv('KAFKA_USER'),
                key: ensureEnv('KAFKA_KEY'),
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
