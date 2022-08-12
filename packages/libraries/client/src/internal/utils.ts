import { createHash } from 'crypto';
import type { HiveClient, HivePluginOptions, AsyncIterableIteratorOrValue } from './types';

export function isAsyncIterableIterator<T>(value: AsyncIterableIteratorOrValue<T>): value is AsyncIterableIterator<T> {
  return typeof (value as any)?.[Symbol.asyncIterator] === 'function';
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

export function cache<R, A, K>(
  fn: (arg: A) => R,
  cacheKeyFn: (arg: A) => K,
  cacheMap: {
    has(key: K): boolean;
    set(key: K, value: R): void;
    get(key: K): R | undefined;
  }
) {
  return (arg: A) => {
    const key = cacheKeyFn(arg);
    const cachedValue = cacheMap.get(key);

    if (cachedValue !== null && typeof cachedValue !== 'undefined') {
      return {
        key,
        value: cachedValue,
      };
    }

    const value = fn(arg);
    cacheMap.set(key, value);

    return {
      key,
      value,
    };
  };
}

export function cacheDocumentKey<T>(doc: T) {
  return createHash('md5').update(JSON.stringify(doc)).digest('hex');
}

const HR_TO_NS = 1e9;
const NS_TO_MS = 1e6;

function deltaFrom(hrtime: [number, number]): { ms: number; ns: number } {
  const delta = process.hrtime(hrtime);
  const ns = delta[0] * HR_TO_NS + delta[1];

  return {
    ns,
    get ms() {
      return ns / NS_TO_MS;
    },
  };
}

export function measureDuration() {
  const startAt = process.hrtime();

  return function end() {
    return deltaFrom(startAt).ns;
  };
}

export function addProperty<T, K extends string>(key: K, value: undefined | null, obj: T): T;
export function addProperty<T, K extends string, V>(
  key: K,
  value: V,
  obj: T
): T & {
  [k in K]: V;
};
export function addProperty<T, K extends string, V>(key: K, value: V | undefined | null, obj: T): any {
  if (value === null || typeof value === 'undefined') {
    return obj;
  }

  return {
    ...obj,
    [key]: value,
  };
}

export function isHiveClient(clientOrOptions: HiveClient | HivePluginOptions): clientOrOptions is HiveClient {
  return 'operationsStore' in clientOrOptions;
}

export function logIf(condition: boolean, message: string, logFn: (message: string) => void) {
  if (condition) {
    logFn(message);
  }
}
