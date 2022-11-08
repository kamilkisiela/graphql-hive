import Toucan from 'toucan-js';
import { createIsKeyValid } from './auth';
import { UnexpectedError } from './errors';
import { createRequestHandler } from './handler';

/**
 * KV Storage for the CDN
 */
declare let HIVE_DATA: KVNamespace;

/**
 * Secret used to sign the CDN keys
 */
declare let KEY_DATA: string;

declare let SENTRY_DSN: string;
/**
 * Name of the environment, e.g. staging, production
 */
declare let SENTRY_ENVIRONMENT: string;
/**
 * Id of the release
 */
declare let SENTRY_RELEASE: string;

const handleRequest = createRequestHandler({
  getRawStoreValue: value => HIVE_DATA.get(value),
  isKeyValid: createIsKeyValid(KEY_DATA),
});

self.addEventListener('fetch', event => {
  try {
    event.respondWith(handleRequest(event.request));
  } catch (error) {
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
    sentry.captureException(error);
    event.respondWith(new UnexpectedError());
  }
});
