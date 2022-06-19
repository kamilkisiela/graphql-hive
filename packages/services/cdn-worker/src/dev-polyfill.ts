import { Response, Request, Headers, ReadableStream } from 'cross-undici-fetch';
import { webcrypto } from 'crypto';

globalThis.Response = Response;
globalThis.Request = Request;
globalThis.Headers = Headers;
globalThis.ReadableStream = ReadableStream;

export const devStorage = new Map<string, string>();

(globalThis as any).KEY_DATA = process.env.CDN_AUTH_PRIVATE_KEY || '';
(globalThis as any).HIVE_DATA = devStorage;
(globalThis as any).crypto = webcrypto as any;
