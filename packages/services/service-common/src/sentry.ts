import * as Sentry from '@sentry/node';
import '@sentry/tracing';
import { Transaction } from '@sentry/tracing';
import type { FastifyInstance, onRequestHookHandler } from 'fastify';
import { cleanRequestId } from './helpers';

export function useSentryTracing(server: FastifyInstance) {
  const requestHandler = Sentry.Handlers.requestHandler();
  const tracingHandler = Sentry.Handlers.tracingHandler();

  function filter(hook: onRequestHookHandler): onRequestHookHandler {
    return function _hook(req, res, done) {
      if (req.routerPath === '/_health' || req.routerPath === '/_readiness') {
        return done();
      }

      if (req.routerPath === '/graphql' && req.headers['x-signature']) {
        // x-signature means it's an introspection query (from readiness check)
        return done();
      }

      hook.call(this, req, res, done);
    };
  }

  server.addHook(
    'onRequest',
    filter((req, res, next) => {
      const requestId = cleanRequestId(req.headers['x-request-id']);
      if (requestId) {
        Sentry.configureScope((scope) => {
          scope.setTag('request_id', requestId as string);
          if (req.headers.referer) {
            scope.setTag('referer', req.headers.referer);
          }
        });
      }

      const transaction: Transaction | undefined = (res.raw as any)
        ?.__sentry_transaction;

      if (transaction) {
        transaction.setData(
          'authorization',
          replaceAuthorization(req.headers.authorization)
        );
        transaction.setData(
          'x-api-token',
          replaceAuthorization(req.headers['x-api-token'] as any)
        );
      }

      requestHandler(req.raw, res.raw, next);
    })
  );

  server.addHook(
    'onRequest',
    filter((req, res, next) => {
      tracingHandler(req.raw, res.raw, next);
    })
  );

  server.setErrorHandler((err, req, reply) => {
    Sentry.withScope((scope) => {
      scope.setUser({
        ip_address: req.ip,
      });

      const requestId = cleanRequestId(req.headers['x-request-id']);

      if (requestId) {
        scope.setTag('request_id', requestId as string);
      }

      const referer = req.headers.referer;

      if (referer) {
        scope.setTag('referer', referer);
      }

      scope.setTag('path', req.raw.url);
      scope.setTag('method', req.raw.method);
      console.log('fastify.setErrorHandler error', err);
      Sentry.captureException(err);

      reply.send({
        error: 500,
        message: 'Internal Server Error',
      });
    });
  });
}

function replaceString(value: string) {
  const jwt = value.split('.');
  if (jwt.length === 3) {
    return `${jwt[0]}.${jwt[1]}.<hidden>`;
  }

  value = value.trim();

  // Mask the token
  if (value.length === 32) {
    return (
      value.substring(0, 3) +
      '•'.repeat(value.length - 6) +
      value.substring(value.length - 3)
    );
  }

  return `string(${value.trim().length})`;
}

function replaceAuthorization(): string;
function replaceAuthorization(value?: string): string;
function replaceAuthorization(value?: string[]): string[];
function replaceAuthorization(value?: string | string[]): string | string[] {
  if (typeof value === 'string') {
    const bearer = 'Bearer ';

    if (value.startsWith(bearer)) {
      return `${bearer}${replaceString(value.replace(bearer, ''))}`;
    }

    return replaceString(value);
  }

  if (Array.isArray(value)) {
    return value.map((v) => replaceAuthorization(v));
  }

  return '<missing>';
}
