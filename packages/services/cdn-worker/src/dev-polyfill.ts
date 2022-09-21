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

(globalThis as any).KEY_DATA = process.env.CDN_AUTH_PRIVATE_KEY || '';
(globalThis as any).HIVE_DATA = devStorage;
