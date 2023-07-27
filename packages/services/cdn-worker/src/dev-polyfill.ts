import 'dotenv/config';
import { crypto, Headers, ReadableStream, Request, Response } from '@whatwg-node/fetch';
import type { Env } from './env';

if (!globalThis.Response) {
  globalThis.Response = Response;
}
if (!globalThis.Request) {
  globalThis.Request = Request;
}
if (!globalThis.Headers) {
  globalThis.Headers = Headers;
}
if (!globalThis.ReadableStream) {
  globalThis.ReadableStream = ReadableStream;
}
if (!globalThis.crypto) {
  globalThis.crypto = crypto;
}

export const devStorage = new Map<string, string>();

export const env: Env = {
  HIVE_DATA: devStorage,
  // eslint-disable-next-line no-process-env
  S3_ENDPOINT: process.env.S3_ENDPOINT || '',
  // eslint-disable-next-line no-process-env
  S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID || '',
  // eslint-disable-next-line no-process-env
  S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY || '',
  // eslint-disable-next-line no-process-env
  S3_BUCKET_NAME: process.env.S3_BUCKET_NAME || '',
  // eslint-disable-next-line no-process-env
  S3_PUBLIC_URL: process.env.S3_PUBLIC_URL || '',
  USAGE_ANALYTICS: {
    writeDataPoint(_input: any) {},
  },
  ERROR_ANALYTICS: {
    writeDataPoint(_input: any) {},
  },
  KEY_VALIDATION_ANALYTICS: {
    writeDataPoint(_input: any) {},
  },
  SENTRY_DSN: '',
  SENTRY_ENVIRONMENT: '',
  SENTRY_RELEASE: '',
};
