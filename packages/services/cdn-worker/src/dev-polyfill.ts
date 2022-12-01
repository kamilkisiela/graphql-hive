import { Response, Request, Headers, ReadableStream, crypto } from '@whatwg-node/fetch';

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

// eslint-disable-next-line no-process-env
(globalThis as any).KEY_DATA = process.env.CDN_AUTH_PRIVATE_KEY || '';
(globalThis as any).HIVE_DATA = devStorage;
// eslint-disable-next-line no-process-env
(globalThis as any).S3_ENDPOINT = process.env.S3_ENDPOINT || '';
// eslint-disable-next-line no-process-env
(globalThis as any).S3_ACCESS_KEY_ID = process.env.S3_ACCESS_KEY_ID || '';
// eslint-disable-next-line no-process-env
(globalThis as any).S3_SECRET_ACCESS_KEY = process.env.S3_SECRET_ACCESS_KEY || '';
// eslint-disable-next-line no-process-env
(globalThis as any).S3_BUCKET_NAME = process.env.S3_BUCKET_NAME || '';
// eslint-disable-next-line no-process-env
(globalThis as any).S3_PUBLIC_URL = process.env.S3_PUBLIC_URL || '';
