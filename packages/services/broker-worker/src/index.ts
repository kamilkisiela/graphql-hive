import Toucan from 'toucan-js';
import { isSignatureValid } from './auth';
import { UnexpectedError } from './errors';
import { handleRequest } from './handler';

self.addEventListener('fetch', event => {
  const sentry = new Toucan({
    dsn: SENTRY_DSN,
    environment: SENTRY_ENVIRONMENT,
    release: SENTRY_RELEASE,
    context: event,
    allowedHeaders: [
      'user-agent',
      'cf-ipcountry',
      'accept-encoding',
      'accept',
      'x-real-ip',
      'cf-connecting-ip',
    ],
    allowedSearchParams: /(.*)/,
  });
  try {
    event.respondWith(
      handleRequest(event.request, isSignatureValid, exception => {
        sentry.captureException(exception);
      }),
    );
  } catch (error) {
    const eventId = sentry.captureException(error);
    event.respondWith(new UnexpectedError(eventId ?? 'unknown'));
  }
});
