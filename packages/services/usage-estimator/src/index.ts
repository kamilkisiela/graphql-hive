#!/usr/bin/env node
import 'reflect-metadata';
import * as Sentry from '@sentry/node';
import { createServer, startMetrics, ensureEnv, registerShutdown, reportReadiness } from '@hive/service-common';
import { createEstimator } from './estimator';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify/dist/trpc-server-adapters-fastify.cjs.js';
import { usageEstimatorApiRouter } from './api';
import { clickHouseElapsedDuration, clickHouseReadDuration } from './metrics';

async function main() {
  Sentry.init({
    serverName: 'usage-estimator',
    enabled: String(process.env.SENTRY_ENABLED) === '1',
    environment: process.env.ENVIRONMENT,
    dsn: process.env.SENTRY_DSN,
    release: process.env.RELEASE || 'local',
  });

  const server = await createServer({
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
          clickHouseReadDuration.labels({ query }).observe(timings.totalSeconds);
          clickHouseElapsedDuration.labels({ query }).observe(timings.elapsedSeconds);
        },
      },
    });

    registerShutdown({
      logger: server.log,
      async onShutdown() {
        await Promise.all([context.stop(), server.close()]);
      },
    });

    await server.register(fastifyTRPCPlugin, {
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
        res.status(200).send(); // eslint-disable-line @typescript-eslint/no-floating-promises -- false positive, FastifyReply.then returns void
      },
    });

    server.route({
      method: ['GET', 'HEAD'],
      url: '/_readiness',
      handler(_, res) {
        const isReady = context.readiness();
        reportReadiness(isReady);
        res.status(isReady ? 200 : 400).send(); // eslint-disable-line @typescript-eslint/no-floating-promises -- false positive, FastifyReply.then returns void
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
