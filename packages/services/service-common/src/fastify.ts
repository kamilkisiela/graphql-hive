import { randomUUID } from 'node:crypto';
import { fastify, type FastifyBaseLogger } from 'fastify';
import cors from '@fastify/cors';
import { Logger } from '@graphql-hive/logger';
import * as Sentry from '@sentry/node';
import { cleanRequestId } from './helpers';
import { useHTTPErrorHandler } from './http-error-handler';
import { useRequestLogging } from './request-logs';

export type { FastifyBaseLogger, FastifyRequest, FastifyReply } from 'fastify';

/* eslint-disable prefer-spread */

// Using spread causes typescript errors
// I prefer to disable eslint over having to use ts-ignore and ts not catching other errors.
function bridgeHiveLoggerToFastifyLogger(logger: Logger): FastifyBaseLogger {
  return {
    debug(...args: Array<any>) {
      logger.debug.apply(logger, args as any);
    },
    error(...args: Array<any>) {
      logger.error.apply(logger, args as any);
    },
    fatal(...args: Array<any>) {
      logger.error.apply(logger, args as any);
    },
    trace(...args: Array<any>) {
      logger.trace.apply(logger, args as any);
    },
    info(...args: Array<any>) {
      logger.info.apply(logger, args as any);
    },
    warn(...args: Array<any>) {
      logger.warn.apply(logger, args as any);
    },
    child() {
      return this;
    },
    level: logger.level === false ? 'silent' : logger.level,
    silent() {},
  };
}

/* eslint-enable prefer-spread */

export async function createServer(options: {
  sentryErrorHandler: boolean;
  name: string;
  log:
    | {
        requests: boolean;
        level: string;
      }
    | Logger;
  cors?: boolean;
  bodyLimit?: number;
  keepAliveTimeout?: number;
  /**
   * Log a warning for every request that arrives without an `x-request-id` header.
   * Enable it on services whose callers always send one (e.g. internal backend services).
   */
  warnOnMissingRequestId?: boolean;
}) {
  const server = fastify({
    disableRequestLogging: true,
    bodyLimit: options.bodyLimit ?? 30e6, // 30mb by default
    ...(options.log instanceof Logger
      ? {
          loggerInstance: bridgeHiveLoggerToFastifyLogger(options.log),
        }
      : {
          logger: {
            level: options.log.level,
            redact: ['request.options', 'options', 'request.headers.authorization'],
          },
        }),
    routerOptions: {
      maxParamLength: 5000,
    },
    requestIdHeader: false,
    genReqId: req => cleanRequestId(req.headers['x-request-id']) || randomUUID(),
    trustProxy: true,
    // If a connection is idle for "keepAliveTimeout" milliseconds or more, the connection times out.
    // The default for fastify is 72_000, but this is meant for more dynamic clients.
    // Requests to Hive's services are proxied through Cloudflare, which has a 900s
    // idle connection timeout, and envoy which is configurable.
    // By setting our keepAliveTimeout slightly longer than the client's, idle timeout
    // we prevent a race condition where the server terminates the connection but the
    // client has not yet -- which results in a 503 upstream disconnect error.
    // This is configurable so self hosters can adjust based on their own infrastructure.
    keepAliveTimeout: options.keepAliveTimeout ?? 910_000,
  });

  server.addHook('onSend', (request, reply, payload, done) => {
    void reply.header('x-request-id', request.id);
    done(null, payload);
  });

  if (options.warnOnMissingRequestId) {
    server.addHook('onRequest', async request => {
      if (request.url === '/_health' || request.url === '/_readiness') {
        return;
      }

      if (!cleanRequestId(request.headers['x-request-id'])) {
        server.log.warn(
          `Missing x-request-id header: ${request.method} ${request.url} (reqId=${request.id})`,
        );
      }
    });
  }

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

  await useHTTPErrorHandler(server, options.sentryErrorHandler);

  if (options.log instanceof Logger === false && options.log.requests) {
    await useRequestLogging(server);
  }

  if (options.cors !== false) {
    await server.register(cors);
  }

  return server;
}
