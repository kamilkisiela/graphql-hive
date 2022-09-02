import { createClient, dedupExchange, errorExchange, fetchExchange } from 'urql';
import { cacheExchange } from '@urql/exchange-graphcache';
import { captureException } from '@sentry/nextjs';
import { Mutation } from './urql-cache';
import { networkStatusExchange } from './urql-exchanges/state';
import { DefinitionNode, Kind, OperationDefinitionNode } from 'graphql';

const noKey = (): null => null;

const SERVER_BASE_PATH = '/api/proxy';

export const urqlClient = createClient({
  url: SERVER_BASE_PATH,
  exchanges: [
    dedupExchange,
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
      },
    }),
    errorExchange({
      onError(error, op) {
        if (error.response?.status === 401) {
          window.location.href = '/logout';
        } else {
          captureException(error);
        }
        if (globalThis.window && process.env['NEXT_PUBLIC_ENVIRONMENT'] === 'development') {
          import('react-notifications-component').then(({ Store }) => {
            const operationName = op.query.definitions.find(isOperationDefinition)?.name?.value ?? '<anonymous>';
            Store.addNotification({
              type: 'danger',
              insert: 'top',
              title: 'GraphQL Error',
              message: `Operation ${operationName} raised error ${error.message}`,
              container: 'bottom-right',
            });
          });
          console.error(error);
        }
      },
    }),
    networkStatusExchange,
    fetchExchange,
  ].filter(Boolean),
});

const isOperationDefinition = (op: DefinitionNode): op is OperationDefinitionNode =>
  op.kind === Kind.OPERATION_DEFINITION;
