import type { FastifyInstance, FastifyLoggerInstance } from 'fastify';
import * as Sentry from '@sentry/node';

export function createErrorHandler(server: FastifyInstance) {
  return function errorHandler(message: string, error: Error, logger?: FastifyLoggerInstance) {
    Sentry.captureException(error);
    if (logger) {
      logger.error(message + '  (error=%s)', error);
    } else {
      server.log.error(message + '  (error=%s)', error);
    }
  };
}
