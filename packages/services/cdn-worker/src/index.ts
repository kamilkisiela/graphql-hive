import Toucan from 'toucan-js';
import { isKeyValid } from './auth';
import { UnexpectedError } from './errors';
import { handleRequest } from './handler';

self.addEventListener('fetch', event => {
  try {
    event.respondWith(handleRequest(event.request, isKeyValid));
  } catch (error) {
    const sentry = new Toucan({
      dsn: SENTRY_DSN,
      environment: SENTRY_ENVIRONMENT,
      release: SENTRY_RELEASE,
      context: event,
      allowedHeaders: ['user-agent', 'cf-ipcountry', 'accept-encoding', 'accept', 'x-real-ip', 'cf-connecting-ip'],
      allowedSearchParams: /(.*)/,
    });
    sentry.captureException(error);
    event.respondWith(new UnexpectedError());
  }
});
