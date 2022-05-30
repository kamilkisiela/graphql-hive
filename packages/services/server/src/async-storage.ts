import { AsyncLocalStorage } from 'node:async_hooks';

export const asyncStorage = new AsyncLocalStorage<{
  requestId?: string;
}>();
