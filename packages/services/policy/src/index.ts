#!/usr/bin/env node
import {
  createServer,
  registerShutdown,
  registerTRPC,
  reportReadiness,
  startMetrics,
} from '@hive/service-common';
import * as Sentry from '@sentry/node';
import { Context, schemaPolicyApiRouter } from './api';
import { env } from './environment';

async function main() {
  if (env.sentry) {
    Sentry.init({
      serverName: 'schema',
      enabled: !!env.sentry,
      environment: env.environment,
      dsn: env.sentry.dsn,
      release: env.release,
    });
  }

  const server = await createServer({
    name: 'policy',
    tracing: false,
    log: {
      level: env.log.level,
      requests: env.log.requests,
    },
  });

  registerShutdown({
    logger: server.log,
    async onShutdown() {
      await server.close();
    },
  });

  try {
    await registerTRPC(server, {
      router: schemaPolicyApiRouter,
      createContext({ req }): Context {
        return { req };
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
        reportReadiness(true);
        void res.status(200).send();
      },
    });

    await server.listen(env.http.port, '0.0.0.0');
    if (env.prometheus) {
      await startMetrics(env.prometheus.labels.instance);
    }
  } catch (error) {
    server.log.fatal(error);
    throw error;
  }
}

main().catch(err => {
  Sentry.captureException(err, {
    level: 'fatal',
  });
  console.error(err);
  process.exit(1);
});
