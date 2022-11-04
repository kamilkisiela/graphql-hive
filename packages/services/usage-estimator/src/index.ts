#!/usr/bin/env node
import 'reflect-metadata';
import * as Sentry from '@sentry/node';
import { createServer, startMetrics, registerShutdown, reportReadiness } from '@hive/service-common';
import { createEstimator } from './estimator';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify/dist/trpc-server-adapters-fastify.cjs.js';
import { usageEstimatorApiRouter } from './api';
import { clickHouseElapsedDuration, clickHouseReadDuration } from './metrics';
import { env } from './environment';

async function main() {
  if (env.sentry) {
    Sentry.init({
      serverName: 'usage-estimator',
      enabled: !!env.sentry,
      environment: env.environment,
      dsn: env.sentry.dsn,
      release: env.release,
    });
  }

  const server = await createServer({
    name: 'usage-estimator',
    tracing: false,
    log: {
      level: env.log.level,
      disableRequestLogging: env.log.disableRequestLogging,
    },
  });

  try {
    const context = createEstimator({
      logger: server.log,
      clickhouse: {
        protocol: env.clickhouse.protocol,
        host: env.clickhouse.host,
        port: env.clickhouse.port,
        username: env.clickhouse.username,
        password: env.clickhouse.password,
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

    if (env.prometheus) {
      await startMetrics(env.prometheus.labels.instance);
    }
    await server.listen(env.http.port, '0.0.0.0');
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
