import { createClient as createSSEClient } from 'graphql-sse';
import Session from 'supertokens-auth-react/recipe/session';
import { createClient, fetchExchange, subscriptionExchange } from 'urql';
import { env } from '@/env/frontend';
import schema from '@/gql/schema';
import { authExchange } from '@urql/exchange-auth';
import { cacheExchange } from '@urql/exchange-graphcache';
import { persistedExchange } from '@urql/exchange-persisted';
import { Mutation } from './urql-cache';
import { networkStatusExchange } from './urql-exchanges/state';

const noKey = (): null => null;

const SERVER_BASE_PATH = env.graphqlPublicEndpoint;

const isSome = <T>(value: T | null | undefined): value is T => value != null;

const sseClient = createSSEClient({
  url: SERVER_BASE_PATH,
  credentials: 'include',
});

const usePersistedOperations = env.graphql.persistedOperations;

export type WorkerSubscriptionSubscribeEvent = {
  type: 'subscriptionStart';
  id: string;
  graphql: {
    query?: string;
    operationName?: string;
    variables?: Record<string, unknown>;
    extensions?: Record<string, unknown>;
  };
};

type WorkerSubscriptionUnsubscribeEvent = {
  type: 'subscriptionEnd';
  id: string;
};

/** Sent by tab to worker to see if worker is still alive. */
type WorkerPongEvent = {
  type: 'pong';
};

export type WorkerEvent =
  | WorkerSubscriptionSubscribeEvent
  | WorkerSubscriptionUnsubscribeEvent
  | WorkerPongEvent;

export type WorkerNextResponse = {
  type: 'next';
  id: string;
  result: any;
};

export type WorkerPing = {
  type: 'ping';
};

export type WorkerCompleteResponse = {
  type: 'complete';
  id: string;
};

export type WorkerResponseEvent = WorkerNextResponse | WorkerCompleteResponse | WorkerPing;

let worker: SharedWorker | null = null;

const subscriptions = new Map<
  string,
  {
    close: () => void;
    push: (data: any) => void;
  }
>();

if (globalThis.window) {
  worker = new SharedWorker(new URL('./graphql-subscriptions-worker', import.meta.url), {
    name: 'hive-graphql-subscriptions-worker',
    credentials: 'include',
  });

  worker.port.addEventListener('message', event => {
    const data = JSON.parse(event.data) as WorkerResponseEvent;
    switch (data.type) {
      case 'next': {
        subscriptions.get(data.id)?.push(data.result);
        break;
      }
      case 'complete': {
        subscriptions.get(data.id)?.close();
        subscriptions.delete(data.id);
        break;
      }
      case 'ping': {
        worker?.port.postMessage(JSON.stringify({ type: 'pong' } as WorkerPongEvent));
        break;
      }
    }
  });

  worker.port.start();
}

export const urqlClient = createClient({
  url: SERVER_BASE_PATH,
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
          subscribe(sink) {
            if (!worker) {
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
            }

            const id = crypto.randomUUID();

            worker.port.postMessage(
              JSON.stringify({
                type: 'subscriptionStart',
                id,
                graphql: {
                  query: usePersistedOperations ? undefined : operation.query,
                  operationName: operation.operationName,
                  variables: operation.variables,
                  extensions: operation.extensions,
                },
              } as WorkerSubscriptionSubscribeEvent),
            );

            subscriptions.set(id, {
              close: () => {
                sink.complete();
              },
              push: data => {
                sink.next(data);
              },
            });

            return {
              unsubscribe: () => {
                worker?.port.postMessage(
                  JSON.stringify({
                    type: 'subscriptionEnd',
                    id,
                  } as WorkerSubscriptionUnsubscribeEvent),
                );
              },
            };
          },
        };
      },
    }),
  ].filter(isSome),
});
