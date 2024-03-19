import { fastify } from 'fastify';
import cors from '@fastify/cors';
import * as Sentry from '@sentry/node';
import { useRequestLogging } from './request-logs';
import { useSentryTracing } from './sentry';

export type { FastifyBaseLogger, FastifyRequest } from 'fastify';

export async function createServer(options: {
  tracing: boolean;
  name: string;
  log: {
    requests: boolean;
    level: string;
  };
  cors?: boolean;
  bodyLimit?: number;
}) {
  const server = fastify({
    disableRequestLogging: true,
    bodyLimit: options.bodyLimit ?? 15e6, // 15mb by default
    logger: {
      level: options.log.level,
    },
    maxParamLength: 5000,
    requestIdHeader: 'x-request-id',
    trustProxy: true,
  });

  server.addHook('onReady', async () => {
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

  if (options.log.requests) {
    await useRequestLogging(server);
  }

  if (options.cors !== false) {
    await server.register(cors);
  }

  return server;
}
