function isBrowser() {
  // eslint-disable-next-line no-restricted-syntax
  return Boolean(
    typeof window !== 'undefined' && '__ENV' in window && window['__ENV'] !== undefined,
  );
}

export function getAllEnv(): Record<string, string | undefined> {
  if (isBrowser()) {
    return (window as any)['__ENV'] ?? {};
  }

  // eslint-disable-next-line no-process-env
  return process.env;
}
