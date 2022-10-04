#!/usr/bin/env node
import * as Sentry from '@sentry/node';
import {
  createServer,
  startMetrics,
  ensureEnv,
  registerShutdown,
  reportReadiness,
  startHeartbeats,
} from '@hive/service-common';
import { createIngestor } from './ingestor';

async function main() {
  Sentry.init({
    serverName: 'usage-ingestor',
    enabled: String(process.env.SENTRY_ENABLED) === '1',
    environment: process.env.ENVIRONMENT,
    dsn: process.env.SENTRY_DSN,
    release: process.env.RELEASE || 'local',
  });

  const server = await createServer({
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
      clickhouseCloud: process.env.CLICKHOUSE_CLOUD_HOST
        ? {
            protocol: ensureEnv('CLICKHOUSE_CLOUD_PROTOCOL'),
            host: ensureEnv('CLICKHOUSE_CLOUD_HOST'),
            port: ensureEnv('CLICKHOUSE_CLOUD_PORT', 'number'),
            username: ensureEnv('CLICKHOUSE_CLOUD_USERNAME'),
            password: ensureEnv('CLICKHOUSE_CLOUD_PASSWORD'),
          }
        : null,
      kafka: {
        topic: ensureEnv('KAFKA_TOPIC'),
        consumerGroup: ensureEnv('KAFKA_CONSUMER_GROUP'),
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

    const stopHeartbeats =
      typeof process.env.HEARTBEAT_ENDPOINT === 'string' && process.env.HEARTBEAT_ENDPOINT.length > 0
        ? startHeartbeats({
            enabled: true,
            endpoint: process.env.HEARTBEAT_ENDPOINT,
            intervalInMS: 20_000,
            onError: server.log.error,
            isReady: readiness,
          })
        : startHeartbeats({ enabled: false });

    registerShutdown({
      logger: server.log,
      async onShutdown() {
        stopHeartbeats();
        await Promise.all([stop(), server.close()]);
      },
    });

    const port = process.env.PORT || 5000;

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
