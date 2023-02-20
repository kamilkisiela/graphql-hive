import { createFetch, Headers, ReadableStream, Request, Response } from '@whatwg-node/fetch';

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

// eslint-disable-next-line no-process-env
(globalThis as any).SIGNATURE = process.env.CF_BROKER_SIGNATURE || '';
