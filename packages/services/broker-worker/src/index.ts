import { Toucan } from 'toucan-js';
import { Logger } from 'workers-loki-logger';
import { isSignatureValid } from './auth';
import { UnexpectedError } from './errors';
import { handleRequest } from './handler';

self.addEventListener('fetch', async event => {
  const requestId =
    event.request.headers.get('x-request-id') ?? Math.random().toString(16).substring(2);

  const sentry = new Toucan({
    dsn: SENTRY_DSN,
    environment: SENTRY_ENVIRONMENT,
    release: SENTRY_RELEASE,
    context: event,
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

  event.request.signal.addEventListener('abort', () => {
    sentry.setTag('requestId', requestId);
    sentry.captureMessage('Request aborted');
  });

  const loki = new Logger({
    lokiSecret: btoa(`${LOKI_USERNAME}:${LOKI_PASSWORD}`),
    lokiUrl: LOKI_ENDPOINT,
    stream: {
      container_name: 'broker-worker',
      env: SENTRY_ENVIRONMENT,
    },
    mdc: {
      requestId,
    },
  });

  const logger = {
    info(message: string) {
      loki.info(message);
      console.info(message);
    },
    error(message: string, error: Error) {
      loki.error(message, error);
      console.error(message, error);
      sentry.setTag('requestId', requestId);
      sentry.captureException(error);
    },
  };

  function flush() {
    event.waitUntil(loki.flush());
  }

  try {
    event.respondWith(
      handleRequest(event.request, isSignatureValid, logger).finally(() => {
        flush();
      }),
    );
  } catch (error) {
    logger.error('Unexpected error', error as any);
    event.respondWith(new UnexpectedError(requestId));
    flush();
  }
});
