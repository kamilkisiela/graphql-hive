import type { RouteHandlerMethod, FastifyRequest, FastifyReply } from 'fastify';
import { Registry } from '@hive/api';
import { cleanRequestId } from '@hive/service-common';
import { createServer } from '@graphql-yoga/node';
import { GraphQLError, ValidationContext, ValidationRule, Kind, OperationDefinitionNode, print } from 'graphql';
import { useGraphQLModules } from '@envelop/graphql-modules';
import { useAuth0 } from '@envelop/auth0';
import { useSentry } from '@envelop/sentry';
import { asyncStorage } from './async-storage';
import { useSentryUser, extractUserId } from './use-sentry-user';
import { useHive } from '@graphql-hive/client';
import { useErrorHandler, Plugin } from '@graphql-yoga/node';

export interface GraphQLHandlerOptions {
  graphiqlEndpoint: string;
  registry: Registry;
  onError: (e: Error) => void;
  signature: string;
}

const NoIntrospection: ValidationRule = (context: ValidationContext) => ({
  Field(node) {
    if (node.name.value === '__schema' || node.name.value === '__type') {
      context.reportError(new GraphQLError('GraphQL introspection is not allowed', [node]));
    }
  },
});

const isNonProductionEnvironment = process.env.ENVIRONMENT !== 'prod';

function useNoIntrospection(params: { signature: string }): Plugin<{ req: FastifyRequest }> {
  return {
    onValidate({ context, addValidationRule }) {
      const isReadinessCheck = context.req.headers['x-signature'] === params.signature;
      if (isReadinessCheck || isNonProductionEnvironment) {
        return;
      }
      addValidationRule(NoIntrospection);
    },
  };
}

export const graphqlHandler = (options: GraphQLHandlerOptions): RouteHandlerMethod => {
  const additionalPlugins: Plugin<any>[] = [];

  if (process.env.ENVIRONMENT === 'prod') {
    additionalPlugins.push(
      useSentry({
        startTransaction: false,
        renameTransaction: true,
        operationName: () => 'graphql',
        transactionName(args) {
          const rootOperation = args.document.definitions.find(
            o => o.kind === Kind.OPERATION_DEFINITION
          ) as OperationDefinitionNode;
          const operationType = rootOperation.operation;
          const opName = args.operationName || rootOperation.name?.value || 'anonymous';

          return `${operationType}.${opName}`;
        },
        includeRawResult: false,
        includeResolverArgs: false,
        includeExecuteVariables: true,
        configureScope(args, scope) {
          scope.setContext('Extra Info', {
            variables: JSON.stringify(args.variableValues),
            operationName: args.operationName,
            operation: print(args.document),
            userId: extractUserId(args.contextValue as any),
          });
        },
        trackResolvers: false,
        appendTags: ({ contextValue }) => {
          const auth0_user_id = extractUserId(contextValue as any);
          const request_id = cleanRequestId((contextValue as any).req.headers['x-request-id']);

          return { auth0_user_id, request_id };
        },
        skip(args) {
          // It's the readiness check
          return args.operationName === 'readiness';
        },
      }),
      useSentryUser(),
      useErrorHandler(errors => {
        errors?.map(e => server.logger.error(e));

        for (const error of errors) {
          options.onError(error);
        }
      })
    );
  }

  const server = createServer<{
    req: FastifyRequest;
    reply: FastifyReply;
    headers: Record<string, string | string[] | undefined>;
  }>({
    maskedErrors: process.env.ENVIRONMENT === 'prod' || process.env.ENVIRONMENT === 'staging',
    plugins: [
      ...additionalPlugins,
      useAuth0({
        onError() {},
        domain: process.env.AUTH0_DOMAIN!,
        audience: process.env.AUTH0_AUDIENCE!,
        extendContextField: 'user',
        headerName: 'authorization',
        preventUnauthenticatedAccess: true,
        tokenType: 'Bearer',
      }),
      useHive({
        debug: true,
        enabled: process.env.ENVIRONMENT === 'prod' || process.env.ENVIRONMENT === 'staging',
        token: process.env.HIVE_API_TOKEN!,
        usage: {
          endpoint: process.env.HIVE_USAGE_ENDPOINT,
          clientInfo(ctx: { req: FastifyRequest; reply: FastifyReply }) {
            const name = ctx.req.headers['graphql-client-name'] as string;
            const version =
              ((ctx.req.headers['graphql-client-version'] as string) ||
                // Our CLI sent a header with a typo.
                // We'll support both for next 30 days or more to collect correct versions.
                // After that, we will drop the header
                // and use SchemaPublishMissingServiceError in schemaPublish mutation by default.
                (ctx.req.headers['graphql-client-vesion'] as string)) ??
              'missing';

            if (name) {
              return { name, version };
            }

            return null;
          },
          exclude: ['readiness'],
        },
        reporting: {
          endpoint: process.env.HIVE_REPORTING_ENDPOINT,
          author: 'Hive API',
          commit: process.env.RELEASE ?? 'local',
        },
      }),
      useGraphQLModules(options.registry),
      useNoIntrospection({ signature: options.signature }),
    ],
    graphiql: request =>
      isNonProductionEnvironment ? { endpoint: request.headers.get('x-use-proxy') ?? request.url } : false,
  });

  return async (req, reply) => {
    const requestIdHeader = req.headers['x-request-id'];
    const requestId = cleanRequestId(requestIdHeader);

    await asyncStorage.run(
      {
        requestId,
      },
      async () => {
        const response = await server.handleIncomingMessage(req, {
          req,
          reply,
          headers: req.headers,
        });

        response.headers.forEach((value, key) => {
          reply.header(key, value); // eslint-disable-line @typescript-eslint/no-floating-promises -- false positive, FastifyReply.then returns void
        });

        if (!reply.hasHeader('x-request-id')) {
          reply.header('x-request-id', requestId || ''); // eslint-disable-line @typescript-eslint/no-floating-promises -- false positive, FastifyReply.then returns void
        }

        reply.status(response.status).send(response.body); // eslint-disable-line @typescript-eslint/no-floating-promises -- false positive, FastifyReply.then returns void
      }
    );
  };
};
