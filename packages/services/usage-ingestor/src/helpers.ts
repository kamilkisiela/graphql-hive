export function cache<R, A, K>(
  fn: (arg: A) => R,
  cacheKeyFn: (arg: A) => K,
  cacheMap: {
    has(key: K): boolean;
    set(key: K, value: R): void;
    get(key: K): R | undefined;
  },
) {
  return (arg: A) => {
    const key = cacheKeyFn(arg);
    const cachedValue = cacheMap.get(key);

    if (cachedValue !== null && typeof cachedValue !== 'undefined') {
      return { key, value: cachedValue };
    }

    const value = fn(arg);
    cacheMap.set(key, value);

    return { key, value };
  };
}

export function errorOkTuple<TResult>(fn: () => TResult) {
  try {
    return [null, fn()] as const;
  } catch (e) {
    return [e, null] as const;
  }
}
