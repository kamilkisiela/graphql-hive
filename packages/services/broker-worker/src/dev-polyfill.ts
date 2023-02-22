import { createFetch, Headers, ReadableStream, Request, Response } from '@whatwg-node/fetch';

const nodeFetch = createFetch({
  useNodeFetch: true,
});

globalThis.Response ||= Response;
globalThis.Request ||= Request;
globalThis.Headers ||= Headers;
globalThis.ReadableStream ||= ReadableStream;

globalThis.fetch = nodeFetch.fetch;

// eslint-disable-next-line no-process-env
(globalThis as any).SIGNATURE = process.env.CF_BROKER_SIGNATURE || '';
