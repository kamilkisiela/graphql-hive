import { createClient, dedupExchange, errorExchange, fetchExchange } from 'urql';
import { cacheExchange } from '@urql/exchange-graphcache';
import { captureException } from '@sentry/nextjs';

import { Mutation } from './urql-cache';
import { networkStatusExchange } from './urql-exchanges/state';

const noKey = (): null => null;

const SERVER_BASE_PATH = '/api/proxy';

export const urqlClient = createClient({
  url: SERVER_BASE_PATH,
  exchanges: [
    dedupExchange,
    cacheExchange({
      updates: {
        Mutation: Mutation as any,
      },
      keys: {
        RequestsOverTime: noKey,
        FailuresOverTime: noKey,
        DurationOverTime: noKey,
        ClientStats: noKey,
        OperationsStats: noKey,
        DurationStats: noKey,
        OrganizationPayload: noKey,
        DurationHistogram: noKey,
        SchemaCompareResult: noKey,
        SchemaChange: noKey,
        SchemaDiff: noKey,
        GitHubIntegration: noKey,
        GitHubRepository: noKey,
      },
    }),
    errorExchange({
      onError(error) {
        if (error.response?.status === 401) {
          window.location.href = '/api/auth/logout';
        } else {
          captureException(error);
        }
      },
    }),
    networkStatusExchange,
    fetchExchange,
  ].filter(Boolean),
});
