import { createFetch, Headers, ReadableStream, Request, Response } from '@whatwg-node/fetch';
import type { Env } from './env';

const nodeFetch = createFetch({
  useNodeFetch: true,
});

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

globalThis.fetch = nodeFetch.fetch;

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
