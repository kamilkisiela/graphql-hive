import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Holds the id of the request being handled, so code that outlives a single request
 * (singleton providers, loggers) can still attach it. Entered by the HTTP handlers.
 */
export const requestIdStorage = new AsyncLocalStorage<{ requestId: string }>();

export function getRequestId(): string | undefined {
  return requestIdStorage.getStore()?.requestId;
}

/** Headers forwarding the id of the request being handled to another service, if there is one. */
export function requestIdHeaders(): Record<string, string> {
  const requestId = getRequestId();
  return requestId ? { 'x-request-id': requestId } : {};
}
