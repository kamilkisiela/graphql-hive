import { createClient, errorExchange, fetchExchange } from 'urql';
import { env } from '@/env/frontend';
import { cacheExchange } from '@urql/exchange-graphcache';
import { persistedExchange } from '@urql/exchange-persisted';
import { Mutation } from './urql-cache';
import { networkStatusExchange } from './urql-exchanges/state';

const noKey = (): null => null;

const SERVER_BASE_PATH = '/api/proxy';

const isSome = <T>(value: T | null | undefined): value is T => value != null;

export const urqlClient = createClient({
  url: SERVER_BASE_PATH,
  exchanges: [
    cacheExchange({
      updates: {
        Mutation,
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
        SchemaExplorer: noKey,
        OrganizationGetStarted: noKey,
        GraphQLObjectType: noKey,
        GraphQLInterfaceType: noKey,
        GraphQLUnionType: noKey,
        GraphQLEnumType: noKey,
        GraphQLInputObjectType: noKey,
        GraphQLScalarType: noKey,
        GraphQLField: noKey,
        GraphQLInputField: noKey,
        GraphQLArgument: noKey,
        SchemaCoordinateUsage: noKey,
        SuccessfulSchemaCheck: ({ id }) => `SchemaCheck:${id}`,
        FailedSchemaCheck: ({ id }) => `SchemaCheck:${id}`,
      },
      globalIDs: ['SuccessfulSchemaCheck', 'FailedSchemaCheck'],
    }),
    networkStatusExchange,
    errorExchange({
      onError(error) {
        if (error.response?.status === 401) {
          window.location.href = '/logout';
        }
      },
    }),
    env.graphql.persistedOperations
      ? persistedExchange({
          enforcePersistedQueries: true,
          enableForMutation: true,
          generateHash: (_, document) => {
            // TODO: improve types here
            return Promise.resolve((document as any)?.['__meta__']?.['hash']);
          },
        })
      : null,
    fetchExchange,
  ].filter(isSome),
});
