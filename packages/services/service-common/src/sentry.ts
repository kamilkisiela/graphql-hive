import type { FastifyInstance, FastifyPluginAsync, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import * as Sentry from '@sentry/node';
import type {
  CustomSamplingContext,
  ExtractedNodeRequestData,
  TraceparentData,
  Transaction,
  TransactionContext,
} from '@sentry/types';
import { extractTraceparentData, normalize } from '@sentry/utils';
import { cleanRequestId } from './helpers';

const plugin: FastifyPluginAsync = async server => {
  server.decorateReply('sentryTransaction', null);

  function shouldIgnore(request: FastifyRequest) {
    if (
      request.routeOptions.url === '/_health' ||
      request.routeOptions.url === '/_readiness' ||
      (request.routeOptions.url === '/graphql' && request.headers['x-signature'])
    ) {
      return true;
    }

    return false;
  }

  server.addHook('onRequest', async (request, reply) => {
    if (shouldIgnore(request)) {
      return;
    }

    const requestId = cleanRequestId(request.headers['x-request-id']);
    if (requestId) {
      Sentry.configureScope(scope => {
        scope.setTag('request_id', requestId);
        if (request.headers.referer) {
          scope.setTag('referer', request.headers.referer);
        }
      });
    }

    // If there is a trace header set, we extract the data from it (parentSpanId, traceId, and sampling decision)
    let traceparentData: TraceparentData | undefined;
    if (request.headers && typeof request.headers['sentry-trace'] === 'string') {
      traceparentData = extractTraceparentData(request.headers['sentry-trace']);
    }

    const extractedRequestData = extractRequestData(request);

    const transaction = startSentryTransaction(
      {
        op: 'http.server',
        name: `${request.method} ${request.url}`,
        ...traceparentData,
      },
      { request: extractedRequestData },
    );
    (reply as any).sentryTransaction = transaction;

    return;
  });

  server.addHook('onResponse', async (request, reply) => {
    if (shouldIgnore(request)) {
      return;
    }

    setImmediate(() => {
      const transaction: Transaction = (reply as any).sentryTransaction;

      transaction.setData('url', request.url);
      transaction.setData('query', request.query);

      transaction.setData('authorization', replaceAuthorization(request.headers.authorization));
      transaction.setData(
        'x-api-token',
        replaceAuthorization(request.headers['x-api-token'] as any),
      );

      transaction.setHttpStatus(reply.statusCode);
      transaction.finish();
    });
    return;
  });

  server.setErrorHandler((err, req, reply) => {
    Sentry.withScope(scope => {
      scope.setUser({
        ip_address: req.ip,
      });

      const requestId = cleanRequestId(req.headers['x-request-id']);

      if (requestId) {
        scope.setTag('request_id', requestId);
      }

      const { referer } = req.headers;

      if (referer) {
        scope.setTag('referer', referer);
      }

      scope.setTag('path', req.raw.url);
      scope.setTag('method', req.raw.method);
      req.log.error(err);
      Sentry.captureException(err);

      req.log.warn('Replying with 500 Internal Server Error');

      void reply.status(500).send(
        JSON.stringify({
          error: 500,
          message: 'Internal Server Error',
        }),
      );
    });
  });
};

const sentryPlugin = fp(plugin, {
  name: 'fastify-sentry',
});

/** Default request keys that'll be used to extract data from the request */
const DEFAULT_REQUEST_KEYS = ['data', 'headers', 'method', 'query_string', 'url'];

function extractRequestData(
  req: FastifyRequest,
  keys: string[] = DEFAULT_REQUEST_KEYS,
): ExtractedNodeRequestData {
  const requestData: { [key: string]: any } = {};

  const headers = req.headers;
  const method = req.method;
  const host = req.hostname || headers.host || '<no host>';
  const protocol = req.protocol;
  const originalUrl = req.url;
  const absoluteUrl = `${protocol}://${host}${originalUrl}`;

  keys.forEach(key => {
    switch (key) {
      case 'headers':
        requestData.headers = headers || {};
        break;
      case 'method':
        requestData.method = method;
        break;
      case 'url':
        requestData.url = absoluteUrl;
        break;
      case 'query_string':
        requestData.query_string = Object.assign({}, req.query);
        break;
      case 'data':
        if (method === 'GET' || method === 'HEAD') {
          break;
        }
        if (req.body !== undefined) {
          requestData.data =
            typeof req.body === 'string' ? req.body : JSON.stringify(normalize(req.body));
        }
        break;
      default:
        if ({}.hasOwnProperty.call(req, key)) {
          requestData[key] = (req as { [key: string]: any })[key];
        }
    }
  });

  return requestData;
}

export async function useSentryTracing(server: FastifyInstance) {
  await server.register(sentryPlugin);
}

function replaceString(value: string) {
  const jwt = value.split('.');
  if (jwt.length === 3) {
    return `${jwt[0]}.${jwt[1]}.<hidden>`;
  }

  value = value.trim();

  // Mask the token
  if (value.length === 32) {
    return value.substring(0, 3) + '•'.repeat(value.length - 6) + value.substring(value.length - 3);
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
    return value.map(v => replaceAuthorization(v));
  }

  return '<missing>';
}

export function startSentryTransaction(
  context: TransactionContext,
  customSamplingContext?: CustomSamplingContext,
) {
  const transaction = Sentry.startTransaction(context, customSamplingContext);
  transaction.sampled = true;

  Sentry.configureScope(scope => scope.setSpan(transaction));

  return transaction;
}
