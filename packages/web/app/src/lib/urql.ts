import { createClient, dedupExchange, errorExchange, fetchExchange } from 'urql';
import { cacheExchange } from '@urql/exchange-graphcache';
import { Mutation } from './urql-cache';
import { networkStatusExchange } from './urql-exchanges/state';

const noKey = (): null => null;

const SERVER_BASE_PATH = '/api/proxy';

export const urqlClient = createClient({
  url: SERVER_BASE_PATH,
  exchanges: [fetchExchange].filter(Boolean),
});
