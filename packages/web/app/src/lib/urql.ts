import { createClient as createSSEClient } from 'graphql-sse';
import Session from 'supertokens-auth-react/recipe/session';
import { createClient, fetchExchange, subscriptionExchange } from 'urql';
import { env } from '@/env/frontend';
import schema from '@/gql/schema';
import { authExchange } from '@urql/exchange-auth';
import { cacheExchange } from '@urql/exchange-graphcache';
import { relayPagination } from '@urql/exchange-graphcache/extras';
import { persistedExchange } from '@urql/exchange-persisted';
import { Mutation } from './urql-cache';
import { networkStatusExchange } from './urql-exchanges/state';

const noKey = (): null => null;

const isSome = <T>(value: T | null | undefined): value is T => value != null;

const sseClient = createSSEClient({
  url: env.graphqlPublicSubscriptionEndpoint,
  credentials: 'include',
});

const usePersistedOperations = env.graphql.persistedOperations;

export const urqlClient = createClient({
  url: env.graphqlPublicEndpoint,
  fetchOptions: {
    headers: {
      'graphql-client-name': 'Hive App',
      'graphql-client-version': env.release,
    },
  },
  exchanges: [
    cacheExchange({
      schema,
      updates: {
        Mutation,
      },
      resolvers: {
        Target: {
          appDeployments: relayPagination(),
        },
        AppDeployment: {
          documents: relayPagination(),
        },
      },
      keys: {
        RequestsOverTime: noKey,
        FailuresOverTime: noKey,
        DurationOverTime: noKey,
        SchemaCoordinateStats: noKey,
        ClientStats: noKey,
        ClientStatsValues: noKey,
        OperationsStats: noKey,
        DurationValues: noKey,
        OrganizationPayload: noKey,
        SchemaCompareResult: noKey,
        SchemaChange: noKey,
        SchemaDiff: noKey,
        GitHubIntegration: noKey,
        GitHubRepository: noKey,
        SchemaExplorer: noKey,
        UnusedSchemaExplorer: noKey,
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
    authExchange(async () => {
      let action: 'NEEDS_REFRESH' | 'VERIFY_EMAIL' | 'UNAUTHENTICATED' = 'UNAUTHENTICATED';

      return {
        addAuthToOperation(operation) {
          return operation;
        },
        willAuthError() {
          return false;
        },
        didAuthError(error) {
          if (error.graphQLErrors.some(e => e.extensions?.code === 'UNAUTHENTICATED')) {
            action = 'UNAUTHENTICATED';
            return true;
          }

          if (error.graphQLErrors.some(e => e.extensions?.code === 'VERIFY_EMAIL')) {
            action = 'VERIFY_EMAIL';
            return true;
          }

          if (error.graphQLErrors.some(e => e.extensions?.code === 'NEEDS_REFRESH')) {
            action = 'NEEDS_REFRESH';
            return true;
          }

          return false;
        },
        async refreshAuth() {
          if (action === 'NEEDS_REFRESH' && (await Session.attemptRefreshingSession())) {
            location.reload();
          } else if (action === 'VERIFY_EMAIL') {
            window.location.href = '/auth/verify-email';
          } else {
            window.location.href = `/auth?redirectToPath=${encodeURIComponent(window.location.pathname)}`;
          }
        },
      };
    }),
    usePersistedOperations
      ? persistedExchange({
          enforcePersistedQueries: true,
          enableForMutation: true,
          enableForSubscriptions: true,
          generateHash: (_, document) => {
            // TODO: improve types here
            return Promise.resolve((document as any)?.['__meta__']?.['hash'] ?? '');
          },
        })
      : null,
    fetchExchange,
    subscriptionExchange({
      forwardSubscription(operation) {
        return {
          subscribe: sink => {
            const dispose = sseClient.subscribe(
              {
                // @ts-expect-error SSE client expects string, we pass undefined 😇
                query: usePersistedOperations ? undefined : operation.query,
                operationName: operation.operationName,
                variables: operation.variables,
                extensions: operation.extensions,
              },
              sink,
            );
            return {
              unsubscribe: () => dispose(),
            };
          },
        };
      },
    }),
  ].filter(isSome),
});
