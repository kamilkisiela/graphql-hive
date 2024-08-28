import 'dotenv/config';
import type { Env } from './env';

export const env: Env = {
  // eslint-disable-next-line no-process-env
  S3_ENDPOINT: process.env.S3_ENDPOINT || '',
  // eslint-disable-next-line no-process-env
  S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID || '',
  // eslint-disable-next-line no-process-env
  S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY || '',
  // eslint-disable-next-line no-process-env
  S3_BUCKET_NAME: process.env.S3_BUCKET_NAME || '',
  SENTRY_DSN: '',
  SENTRY_ENVIRONMENT: '',
  SENTRY_RELEASE: '',
};
