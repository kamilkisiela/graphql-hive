#!/usr/bin/env node
import 'reflect-metadata';
import {
  createServer,
  registerShutdown,
  registerTRPC,
  reportReadiness,
  startMetrics,
} from '@hive/service-common';
import * as Sentry from '@sentry/node';
import { createContext, usageEstimatorApiRouter } from './api';
import { env } from './environment';
import { createEstimator } from './estimator';
import { clickHouseElapsedDuration, clickHouseReadDuration } from './metrics';

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
      requests: env.log.requests,
    },
  });

  try {
    const estimator = createEstimator({
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
        await Promise.all([estimator.stop(), server.close()]);
      },
    });

    await registerTRPC(server, {
      router: usageEstimatorApiRouter,
      createContext({ req }) {
        return createContext(estimator, req);
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
        const isReady = estimator.readiness();
        reportReadiness(isReady);
        void res.status(isReady ? 200 : 400).send();
      },
    });

    if (env.prometheus) {
      await startMetrics(env.prometheus.labels.instance);
    }
    await server.listen(env.http.port);
    await estimator.start();
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
