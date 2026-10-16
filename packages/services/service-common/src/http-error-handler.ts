import { type FastifyError, type FastifyInstance, type FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import * as Sentry from '@sentry/node';
import { maskToken } from './helpers';

const plugin: FastifyPluginAsync<{ isSentryEnabled: boolean }> = async (server, opts) => {
  if (opts.isSentryEnabled) {
    server.decorateReply('sentry', null);
  }

  server.setErrorHandler((err, req, reply) => {
    if (isFastifyError(err) && err.statusCode && err.statusCode < 500) {
      req.log.warn(err.message);
      void reply.status(err.statusCode).send({
        error: err.statusCode,
        message: err.message,
        requestId: req.id,
      });
      return;
    }

    function sendInternalError() {
      req.log.warn('Replying with 500 Internal Server Error');
      void reply.status(500).send({
        error: 500,
        message: 'Internal Server Error',
        requestId: req.id,
      });
    }

    if (!opts.isSentryEnabled) {
      return sendInternalError();
    }

    Sentry.withScope(scope => {
      scope.setUser({ ip_address: req.ip });
      const tokenHeader =
        req.headers['x-api-token'] || req.headers.authorization?.replace('Bearer ', '');
      const maskedToken = typeof tokenHeader === 'string' ? maskToken(tokenHeader) : null;
      scope.setTag('request_id', req.id);
      const { referer } = req.headers;
      if (referer) {
        scope.setTag('referer', referer);
      }
      scope.setTag('path', req.raw.url);
      scope.setTag('method', req.raw.method);
      if (maskedToken) {
        scope.setTag('masked_token', maskedToken);
      }
      req.log.error(err);
      Sentry.captureException(err);

      return sendInternalError();
    });
  });
};

const httpErrorHandler = fp(plugin, {
  name: 'fastify-http-error-handler',
});

export async function useHTTPErrorHandler(server: FastifyInstance, isSentryEnabled: boolean) {
  await server.register(httpErrorHandler, {
    isSentryEnabled,
  });
}

function isFastifyError(error: unknown): error is FastifyError {
  return typeof error === 'object' && !!error && 'statusCode' in error && 'code' in error;
}
