import type { Env } from './env';

export const env: Env = {
  // eslint-disable-next-line no-process-env
  SIGNATURE: process.env.CF_BROKER_SIGNATURE || '',
  SENTRY_DSN: '',
  SENTRY_ENVIRONMENT: '',
  SENTRY_RELEASE: '',
  LOKI_PASSWORD: '',
  LOKI_USERNAME: '',
  LOKI_ENDPOINT: '',
};
