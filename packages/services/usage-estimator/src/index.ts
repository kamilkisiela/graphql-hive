#!/usr/bin/env node
import 'reflect-metadata';
import * as Sentry from '@sentry/node';
import {
  createServer,
  startMetrics,
  ensureEnv,
  registerShutdown,
} from '@hive/service-common';
import { createEstimator } from './estimator';
import { createConnectionString } from '@hive/storage';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify/dist/trpc-server-adapters-fastify.cjs.js';
import { usageEstimatorApiRouter } from './api';
import { clickHouseElapsedDuration, clickHouseReadDuration } from './metrics';

async function main() {
  Sentry.init({
    serverName: 'usage-reporter',
    enabled: process.env.ENVIRONMENT === 'prod',
    environment: process.env.ENVIRONMENT,
    dsn: process.env.SENTRY_DSN,
    release: process.env.RELEASE || 'local',
  });

  const server = createServer({
    name: 'usage-estimator',
    tracing: false,
  });

  try {
    const context = createEstimator({
      logger: server.log,
      clickhouse: {
        protocol: ensureEnv('CLICKHOUSE_PROTOCOL'),
        host: ensureEnv('CLICKHOUSE_HOST'),
        port: ensureEnv('CLICKHOUSE_PORT', 'number'),
        username: ensureEnv('CLICKHOUSE_USERNAME'),
        password: ensureEnv('CLICKHOUSE_PASSWORD'),
        onReadEnd(query, timings) {
          clickHouseReadDuration
            .labels({ query })
            .observe(timings.totalSeconds);
          clickHouseElapsedDuration
            .labels({ query })
            .observe(timings.elapsedSeconds);
        },
      },
      storage: {
        connectionString: createConnectionString(process.env as any),
      },
    });

    registerShutdown({
      logger: server.log,
      async onShutdown() {
        await Promise.all([stop(), server.close()]);
      },
    });

    server.register(fastifyTRPCPlugin, {
      prefix: '/trpc',
      trpcOptions: {
        router: usageEstimatorApiRouter,
        createContext: () => context,
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
        res.status(context.readiness() ? 200 : 400).send();
      },
    });

    if (process.env.METRICS_ENABLED === 'true') {
      await startMetrics();
    }
    await server.listen(port, '0.0.0.0');
    await context.start();
  } catch (error) {
    server.log.fatal(error);
    Sentry.captureException(error, {
      level: Sentry.Severity.Fatal,
    });
  }
}

main().catch((err) => {
  Sentry.captureException(err, {
    level: Sentry.Severity.Fatal,
  });
  console.error(err);
  process.exit(1);
});
