import { AsyncLocalStorage } from 'async_hooks';

export const asyncStorage = new AsyncLocalStorage<{
  requestId?: string;
}>();
