function isBrowser(): boolean {
  return typeof window !== 'undefined' && '__ENV' in window && window.__ENV !== undefined;
}

export function getAllEnv(): Record<string, string | undefined> {
  if (isBrowser()) {
    return (window as any).__ENV ?? {};
  }

  throw new Error('getAllEnv should only be called in the browser');
}
