import { fastify } from 'fastify';
import cors from 'fastify-cors';
import * as Sentry from '@sentry/node';
import { useSentryTracing } from './sentry';

export type { FastifyLoggerInstance } from 'fastify';

export async function createServer(options: { tracing: boolean; name: string }) {
  const server = fastify({
    disableRequestLogging: true,
    bodyLimit: 11e6, // 11 mb
    logger: {
      level: 'debug',
    },
    maxParamLength: 5000,
    requestIdHeader: 'x-request-id',
    trustProxy: true,
  });

  server.addHook('onReady', () => {
    server.log.info(`Service "${options.name}" is ready`);
  });

  process
    .on('unhandledRejection', (reason, p) => {
      Sentry.captureException(reason);
      server.log.error(reason as any, 'Unhandled Rejection at Promise', p);
    })
    .on('uncaughtException', err => {
      Sentry.captureException(err);
      server.log.error(err as any, 'Uncaught Exception thrown');
    });

  if (options.tracing) {
    await useSentryTracing(server);
  }

  await server.register(cors);

  return server;
}
