import { Response, Request, Headers, ReadableStream } from 'cross-undici-fetch';
import { webcrypto } from 'crypto';

globalThis.Response = Response;
globalThis.Request = Request;
globalThis.Headers = Headers;
globalThis.ReadableStream = ReadableStream;
globalThis.TextEncoder = TextEncoder;
globalThis.crypto = webcrypto as any;
