import type { FastifyInstance, FastifyLoggerInstance } from 'fastify';
import * as Sentry from '@sentry/node';
import { createLogger } from './logger';
import { createServer } from 'http'

export function createErrorHandler(server: FastifyInstance | ReturnType<typeof createServer>) {
  return function errorHandler(
    message: string,
    error: Error,
    logger?: FastifyLoggerInstance | ReturnType<typeof createLogger>,
  ) {
    Sentry.captureException(error);
    if (logger) {
      logger.error(message + '  (error=%s)', error);
    } else {
      server.log.error(message + '  (error=%s)', error);
    }
  };
}
