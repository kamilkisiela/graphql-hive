import { crypto, Headers, ReadableStream, Request, Response } from '@whatwg-node/fetch';

globalThis.Response ||= Response;
globalThis.Request ||= Request;
globalThis.Headers ||= Headers;
globalThis.ReadableStream ||= ReadableStream;
globalThis.crypto ||= crypto;

export const devStorage = new Map<string, string>();

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

(globalThis as any).USAGE_ANALYTICS = {
  writeDataPoint(_input: any) {},
};
(globalThis as any).ERROR_ANALYTICS = {
  writeDataPoint(_input: any) {},
};
(globalThis as any).KEY_VALIDATION_ANALYTICS = {
  writeDataPoint(_input: any) {},
};
