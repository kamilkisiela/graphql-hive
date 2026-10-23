import { createClient as createSSEClient } from 'graphql-sse';
import {
  createClient,
  fetchExchange,
  mapExchange,
  subscriptionExchange,
  type CombinedError,
} from 'urql';
import { env } from '@/env/frontend';
import { attemptRefreshingSession, signOut } from '@/lib/auth/session';
import { authExchange } from '@urql/exchange-auth';
import { cacheExchange } from '@urql/exchange-graphcache';
import { cacheOptions } from './urql-cache';
import { networkStatusExchange } from './urql-exchanges/state';

const isSome = <T>(value: T | null | undefined): value is T => value != null;

const sseClient = createSSEClient({
  url: env.graphqlPublicSubscriptionEndpoint,
  credentials: 'include',
});

let leaving: Promise<void> | null = null;

/** Ends the session and sends the browser to sign-in, once, however many answers ask for it. */
function leaveToSignIn(): Promise<void> {
  leaving ??= signOut().then(() => {
    window.location.assign(`/auth?redirectToPath=${encodeURIComponent(window.location.pathname)}`);
  });
  return leaving;
}

/**
 * Answers that end the page rather than the operation. They are handled on every result instead
 * of inside the auth exchange: that exchange never refreshes an operation it already re-sent after
 * a refresh, so such an answer would otherwise reach the page as an error.
 */
function redirectOnAuthError(error: CombinedError): void {
  const codes = error.graphQLErrors.map(e => e.extensions?.code);
  if (codes.includes('UNAUTHENTICATED')) {
    void leaveToSignIn();
    return;
  }
  if (codes.includes('VERIFY_EMAIL')) {
    window.location.assign('/auth/verify-email');
    return;
  }
  const oidcError = error.graphQLErrors.find(e => e.extensions?.code === 'NEEDS_OIDC');
  if (oidcError) {
    const organizationSlug = oidcError.extensions?.organizationSlug as string;
    const oidcIntegrationId = oidcError.extensions?.oidcIntegrationId as string;
    window.location.assign(
      `/${organizationSlug}/oidc-request?id=${oidcIntegrationId}&redirectToPath=${encodeURIComponent(window.location.pathname)}`,
    );
  }
}

export const urqlClient = createClient({
  url: env.graphqlPublicEndpoint,
  // @urql/core 6 sends small queries as GET by default; the API is called with POST only.
  preferGetMethod: false,
  fetchOptions: {
    // The session is cookies on the API origin, which is cross-origin in local development.
    credentials: 'include',
    headers: {
      'graphql-client-name': 'hive-app',
      'graphql-client-version': env.release,
    },
  },
  exchanges: [
    cacheExchange(cacheOptions),
    networkStatusExchange,
    // Before the auth exchange, so it also sees the answers of operations re-sent after a refresh.
    mapExchange({ onError: redirectOnAuthError }),
    authExchange(async () => ({
      addAuthToOperation(operation) {
        return operation;
      },
      willAuthError() {
        return false;
      },
      didAuthError(error) {
        return error.graphQLErrors.some(e => e.extensions?.code === 'NEEDS_REFRESH');
      },
      async refreshAuth() {
        let refreshed: boolean;
        try {
          refreshed = await attemptRefreshingSession();
        } catch {
          // Rate limited or offline: the queued operations fail with this error and a retry
          // starts over, instead of signing the user out.
          throw new Error('Could not refresh your session');
        }
        if (!refreshed) {
          await leaveToSignIn();
        }
        // Otherwise the queued operations are re-sent with the rotated cookies. One that still
        // answers NEEDS_REFRESH after that fails instead of refreshing again.
      },
    })),
    env.graphql.persistedOperationsPrefix !== null
      ? mapExchange({
          /**
           * urql is requires the document node to contain zero definitions and a property named "documentId",
           * due to tight-coupling with graphql.tada
           **/
          onOperation(op) {
            return {
              ...op,
              query: {
                documentId:
                  (env.graphql.persistedOperationsPrefix ?? '') +
                  (op.query as any)?.['__meta__']?.['hash'],
                definitions: [],
              } as any,
            };
          },
        })
      : null,
    fetchExchange,
    subscriptionExchange({
      forwardSubscription(operation) {
        return {
          subscribe: sink => {
            const usePersistedOperations = env.graphql.persistedOperationsPrefix !== null;

            const dispose = sseClient.subscribe(
              {
                ...(usePersistedOperations
                  ? { documentId: operation.documentId! }
                  : { query: operation.query! }),
                operationName: operation.operationName,
                variables: operation.variables,
                extensions: operation.extensions,
              } satisfies GraphQLPayload as any,
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

type GraphQLPayload = {
  variables?: Record<string, any>;
  operationName?: string;
  extensions?: Record<string, any>;
} & (
  | {
      query: string;
      documentId?: void;
    }
  | {
      query?: void;
      documentId: string;
    }
);
