import { Toucan } from 'toucan-js';
import { Logger } from 'workers-loki-logger';
import { createSignatureValidator } from './auth';
import type { Env } from './env';
import { UnexpectedError } from './errors';
import { handleRequest } from './handler';

const handler: ExportedHandler<Env> = {
  async fetch(request: Request, env, ctx) {
    const requestId =
      request.headers.get('x-request-id') ?? Math.random().toString(16).substring(2);
    const isSignatureValid = createSignatureValidator(env.SIGNATURE);

    const sentry = new Toucan({
      dsn: env.SENTRY_DSN,
      environment: env.SENTRY_ENVIRONMENT,
      release: env.SENTRY_RELEASE,
      context: ctx,
      request,
      dist: 'broker-worker',
      requestDataOptions: {
        allowedHeaders: [
          'user-agent',
          'cf-ipcountry',
          'accept-encoding',
          'accept',
          'x-real-ip',
          'x-request-id',
          'cf-connecting-ip',
        ],
        allowedSearchParams: /(.*)/,
      },
    });

    request.signal.addEventListener('abort', () => {
      sentry.setTag('requestId', requestId);
      sentry.captureMessage('Request aborted');
    });

    const loki =
      typeof env.LOKI_ENDPOINT !== 'undefined' &&
      typeof env.LOKI_USERNAME !== 'undefined' &&
      typeof env.LOKI_PASSWORD !== 'undefined'
        ? new Logger({
            lokiSecret: btoa(`${env.LOKI_USERNAME}:${env.LOKI_PASSWORD}`),
            lokiUrl: `https://${env.LOKI_ENDPOINT}`,
            stream: {
              container_name: 'broker-worker',
              env: env.SENTRY_ENVIRONMENT,
            },
            mdc: {
              requestId,
            },
          })
        : null;

    const logger = {
      info(message: string) {
        loki?.info(message);
        console.info(message);
      },
      error(message: string, error: Error) {
        loki?.error(message, error);
        console.error(message, error);
        sentry.setTag('requestId', requestId);
        sentry.captureException(error);
      },
    };

    function flush() {
      loki && ctx.waitUntil(loki.flush());
    }

    try {
      return await handleRequest(request, isSignatureValid, logger, requestId).finally(() => {
        flush();
      });
    } catch (error) {
      logger.error('Unexpected error', error as any);
      flush();
      return new UnexpectedError(requestId);
    }
  },
};

export default handler;
