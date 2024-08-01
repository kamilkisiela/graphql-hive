import { crypto, TextEncoder } from '@whatwg-node/fetch';
import { hiveClientSymbol } from './client.js';
import type { HiveClient, HivePluginOptions, Logger } from './types.js';

export const isCloudflareWorker =
  typeof caches !== 'undefined' && 'default' in caches && !!caches.default;

async function digest(algo: 'SHA-256' | 'SHA-1', output: 'hex' | 'base64', data: string) {
  const buffer = await crypto.subtle.digest(algo, new TextEncoder().encode(data));
  if (output === 'hex') {
    return arrayBufferToHEX(buffer);
  }

  return arrayBufferToBase64(buffer);
}

function arrayBufferToHEX(buffer: ArrayBuffer) {
  return Array.prototype.map
    .call(new Uint8Array(buffer), x => ('00' + x.toString(16)).slice(-2))
    .join('');
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  return btoa(String.fromCharCode.apply(null, new Uint8Array(buffer) as unknown as number[]));
}

export function createHash(algo: 'SHA-256' | 'SHA-1') {
  let str: string = '';

  return {
    update(data: string) {
      str += data;
      return this;
    },
    async digest(output: 'hex' | 'base64') {
      return digest(algo, output, str);
    },
  };
}

export function memo<R, A, K>(fn: (arg: A) => R, cacheKeyFn: (arg: A) => K): (arg: A) => R {
  let memoizedResult: R | null = null;
  let memoizedKey: K | null = null;

  return (arg: A) => {
    const currentKey = cacheKeyFn(arg);
    if (memoizedKey === currentKey) {
      return memoizedResult!;
    }

    memoizedKey = currentKey;
    memoizedResult = fn(arg);

    return memoizedResult;
  };
}

export function isAsyncIterable<T>(value: any): value is AsyncIterable<T> {
  return value?.[Symbol.asyncIterator] != null;
}

export function cache<R, A, K, V>(
  fn: (arg: A, arg2: V) => R,
  cacheKeyFn: (arg: A, arg2: V) => Promise<K>,
  cacheMap: {
    has(key: K): boolean;
    set(key: K, value: R): void;
    get(key: K): R | undefined;
  },
) {
  return async (arg: A, arg2: V) => {
    const key = await cacheKeyFn(arg, arg2);
    const cachedValue = await cacheMap.get(key);

    if (cachedValue !== null && typeof cachedValue !== 'undefined') {
      return {
        key,
        value: cachedValue,
        cacheHit: true,
      };
    }

    const value = fn(arg, arg2);
    cacheMap.set(key, value);

    return {
      key,
      value,
      cacheHit: false,
    };
  };
}

export async function cacheDocumentKey<T, V>(doc: T, variables: V | null) {
  const hasher = createHash('SHA-1').update(JSON.stringify(doc));

  if (variables) {
    hasher.update(
      JSON.stringify(variables, (_, value) => {
        if (
          (value && typeof value === 'object' && Object.keys(value).length) ||
          (Array.isArray(value) && value.length)
        ) {
          return value;
        }

        return '';
      }),
    );
  }

  return hasher.digest('hex');
}

const HR_TO_NS = 1e9;
const NS_TO_MS = 1e6;

function deltaFrom(startedAt: number): { ms: number; ns: number } {
  const endedAt = performance.now();
  const ns = Math.round(((endedAt - startedAt) * HR_TO_NS) / 1000);

  return {
    ns,
    get ms() {
      return ns / NS_TO_MS;
    },
  };
}

export function measureDuration() {
  const startAt = performance.now();

  return function end() {
    return deltaFrom(startAt).ns;
  };
}

export function addProperty<T, K extends string>(key: K, value: undefined | null, obj: T): T;
export function addProperty<T, K extends string, V>(
  key: K,
  value: V,
  obj: T,
): T & {
  [k in K]: V;
};
export function addProperty<T, K extends string, V>(
  key: K,
  value: V | undefined | null,
  obj: T,
): any {
  if (value === null || typeof value === 'undefined') {
    return obj;
  }

  return {
    ...obj,
    [key]: value,
  };
}

export function isHiveClient(
  clientOrOptions: HiveClient | HivePluginOptions,
): clientOrOptions is HiveClient {
  return hiveClientSymbol in clientOrOptions;
}

export function logIf(condition: boolean, message: string, logFn: (message: string) => void) {
  if (condition) {
    logFn(message);
  }
}

export function joinUrl(url: string, subdirectory: string) {
  const normalizedUrl = url.endsWith('/') ? url.slice(0, -1) : url;
  const normalizedSubdirectory = subdirectory.startsWith('/')
    ? subdirectory.slice(1)
    : subdirectory;

  return normalizedUrl + '/' + normalizedSubdirectory;
}

const hiveSymbol = Symbol('hive-logger');

type HiveLogger = {
  info(message: string): void;
  error(error: any, ...data: any[]): void;
  [hiveSymbol]: {
    path: string;
    logger: Logger;
  };
};

export function createHiveLogger(baseLogger: Logger, prefix: string): HiveLogger {
  const context: HiveLogger[typeof hiveSymbol] = {
    path: '',
    logger: baseLogger,
    // @ts-expect-error internal stuff
    ...baseLogger?.[hiveSymbol],
  };
  context.path = context.path + prefix;

  const { logger, path } = context;

  return {
    [hiveSymbol]: context,
    info: (message: string) => {
      logger.info(`${path} ${message}`);
    },
    error: (error: any, ...data: any[]) => {
      if (error.stack) {
        for (const stack of error.stack.split('\n')) {
          logger.error(`${path} ${stack}`);
        }
      } else {
        logger.error(`${path} ${String(error)}`, ...data);
      }
    },
  };
}
