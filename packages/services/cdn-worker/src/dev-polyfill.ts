import { Response, Request, Headers, ReadableStream } from 'cross-undici-fetch';

globalThis.Response = Response;
globalThis.Request = Request;
globalThis.Headers = Headers;
globalThis.ReadableStream = ReadableStream;

export const devStorage = new Map<string, string>();

(globalThis as any).KEY_DATA = '';
(globalThis as any).HIVE_DATA = devStorage;
