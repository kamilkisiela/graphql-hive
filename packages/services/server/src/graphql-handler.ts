/* eslint-disable @typescript-eslint/no-floating-promises */
import type { RouteHandlerMethod, FastifyRequest, FastifyReply } from 'fastify';
import { Registry } from '@hive/api';
import { cleanRequestId } from '@hive/service-common';
import { createYoga, useErrorHandler, Plugin } from 'graphql-yoga';
import { GraphQLError, ValidationContext, ValidationRule, Kind, OperationDefinitionNode, print } from 'graphql';
import { useGraphQLModules } from '@envelop/graphql-modules';
import { useGenericAuth } from '@envelop/generic-auth';
import { fetch } from '@whatwg-node/fetch';
import { useSentry } from '@envelop/sentry';
import { asyncStorage } from './async-storage';
import { useSentryUser, extractUserId } from './use-sentry-user';
import { useHive } from '@graphql-hive/client';
import hyperid from 'hyperid';
import zod from 'zod';
import { HiveError } from '@hive/api';
import { Readable } from 'stream';

const reqIdGenerate = hyperid({ fixedLength: true });

const SuperTokenAccessTokenModel = zod.object({
  version: zod.literal('1'),
  superTokensUserId: zod.string(),
  /**
   * Supertokens for some reason omits externalUserId from the access token payload if it is null.
   */
  externalUserId: zod.optional(zod.union([zod.string(), zod.null()])),
  email: zod.string(),
});

export interface GraphQLHandlerOptions {
  graphiqlEndpoint: string;
  registry: Registry;
  signature: string;
  supertokens: {
    connectionUri: string;
    apiKey: string;
  };
}

export type SuperTokenSessionPayload = zod.TypeOf<typeof SuperTokenAccessTokenModel>;

interface Context {
  req: FastifyRequest;
  reply: FastifyReply;
  headers: Record<string, string | string[] | undefined>;
  requestId?: string | null;
  session: SuperTokenSessionPayload | null;
}

const NoIntrospection: ValidationRule = (context: ValidationContext) => ({
  Field(node) {
    if (node.name.value === '__schema' || node.name.value === '__type') {
      context.reportError(new GraphQLError('GraphQL introspection is not allowed', [node]));
    }
  },
});

const isNonProductionEnvironment = process.env.ENVIRONMENT !== 'prod';

function hasFastifyRequest(ctx: unknown): ctx is {
  req: FastifyRequest;
} {
  return !!ctx && typeof ctx === 'object' && 'req' in ctx;
}

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
  const server = createYoga<Context>({
    plugins: [
      useSentry({
        startTransaction: false,
        renameTransaction: true,
        /**
         * When it's not `null`, the plugin modifies the error object.
         * We end up with an unintended error masking, because the GraphQLYogaError is replaced with GraphQLError (without error.originalError).
         */
        eventIdKey: null,
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
          const transaction = scope.getTransaction();

          // Reduce the number of transactions to avoid overloading Sentry
          const ctx = args.contextValue as Context;
          const clientNameHeaderValue = ctx.req.headers['graphql-client-name'];
          const clientName = Array.isArray(clientNameHeaderValue) ? clientNameHeaderValue[0] : clientNameHeaderValue;

          if (transaction) {
            transaction.setTag('graphql_client_name', clientName);
            transaction.sampled = clientName !== 'Hive Client';
          }

          scope.setContext('Extra Info', {
            variables: JSON.stringify(args.variableValues),
            operationName: args.operationName,
            operation: print(args.document),
            userId: extractUserId(args.contextValue as any),
          });
        },
        trackResolvers: false,
        appendTags: ({ contextValue }) => {
          const supertokens_user_id = extractUserId(contextValue as any);
          const request_id = cleanRequestId((contextValue as Context).req.headers['x-request-id']);

          return {
            supertokens_user_id,
            request_id,
          };
        },
        skip(args) {
          // It's the readiness check
          return args.operationName === 'readiness';
        },
      }),
      useSentryUser(),
      useErrorHandler((errors, ctx) => {
        for (const error of errors) {
          // Only log unexpected errors.
          if (error.originalError instanceof GraphQLError) {
            continue;
          }

          if (hasFastifyRequest(ctx)) {
            ctx.req.log.error(error);
          } else {
            server.logger.error(error);
          }
        }
      }),
      useGenericAuth({
        mode: 'resolve-only',
        contextFieldName: 'session',
        resolveUserFn: async (ctx: Context) => {
          if (ctx.headers['authorization']) {
            let authHeader = ctx.headers['authorization'];
            authHeader = Array.isArray(authHeader) ? authHeader[0] : authHeader;

            const authHeaderParts = authHeader.split(' ');
            if (authHeaderParts.length === 2 && authHeaderParts[0] === 'Bearer') {
              const accessToken = authHeaderParts[1];
              // The token issued by Hive is always 32 characters long.
              // Everything longer should be treated as an supertokens token (JWT).
              if (accessToken.length > 32) {
                return await verifySuperTokensSession(
                  options.supertokens.connectionUri,
                  options.supertokens.apiKey,
                  accessToken
                );
              }
            }
          }

          return null;
        },
      }),
      useHive({
        debug: true,
        enabled: String(process.env.SENTRY_ENABLED) === '1',
        token: process.env.HIVE_API_TOKEN!,
        usage: {
          endpoint: process.env.HIVE_USAGE_ENDPOINT,
          clientInfo(ctx: { req: FastifyRequest; reply: FastifyReply }) {
            const name = ctx.req.headers['graphql-client-name'] as string;
            const version = (ctx.req.headers['graphql-client-version'] as string) ?? 'missing';

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
    /*
    graphiql: request =>
      isNonProductionEnvironment ? { endpoint: request.headers.get('x-use-proxy') ?? request.url } : false,
    */
  });

  return async (req, reply) => {
    const requestIdHeader = req.headers['x-request-id'] ?? reqIdGenerate();
    const requestId = cleanRequestId(requestIdHeader);

    await asyncStorage.run(
      {
        requestId,
      },
      async () => {
        const response = await server.handleNodeRequest(req, {
          req,
          reply,
          headers: req.headers,
          requestId,
          session: null,
        });

        response.headers.forEach((value, key) => {
          reply.header(key, value);
        });

        if (!reply.hasHeader('x-request-id')) {
          reply.header('x-request-id', requestId || '');
        }

        reply.status(response.status);

        reply.send(Readable.from(response.body!));

        return reply;
      }
    );
  };
};

/**
 * Verify whether a SuperTokens access token session is valid.
 * https://app.swaggerhub.com/apis/supertokens/CDI/2.15.1#/Session%20Recipe/verifySession
 */
async function verifySuperTokensSession(
  connectionUri: string,
  apiKey: string,
  accessToken: string
): Promise<SuperTokenSessionPayload> {
  const response = await fetch(connectionUri + '/recipe/session/verify', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'api-key': apiKey,
      rid: 'session',
    },
    body: JSON.stringify({
      accessToken,
      enableAntiCsrf: false,
      doAntiCsrfCheck: false,
    }),
  });
  const body = await response.text();
  if (response.status !== 200) {
    console.error(`SuperTokens session verification failed with status ${response.status}.\n` + body);
    throw new HiveError(`Invalid token.`);
  }

  const result = JSON.parse(body);
  const sessionInfo = SuperTokenAccessTokenModel.parse(result.session.userDataInJWT);
  // ensure externalUserId is a string or null
  return {
    ...sessionInfo,
    externalUserId: sessionInfo.externalUserId ?? null,
  };
}
