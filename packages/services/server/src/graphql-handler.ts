import { createHash } from 'node:crypto';
import type {
  FastifyLoggerInstance,
  FastifyReply,
  FastifyRequest,
  RouteHandlerMethod,
} from 'fastify';
import { DocumentNode, GraphQLError, print, ValidationContext, ValidationRule } from 'graphql';
import { createYoga, Plugin, useErrorHandler } from 'graphql-yoga';
import hyperid from 'hyperid';
import zod from 'zod';
import { isGraphQLError } from '@envelop/core';
import { useGenericAuth } from '@envelop/generic-auth';
import { useGraphQLModules } from '@envelop/graphql-modules';
import { useSentry } from '@envelop/sentry';
import { useYogaHive } from '@graphql-hive/client';
import { usePersistedOperations } from '@graphql-yoga/plugin-persisted-operations';
import { useResponseCache } from '@graphql-yoga/plugin-response-cache';
import { HiveError, Registry, RegistryContext } from '@hive/api';
import { cleanRequestId } from '@hive/service-common';
import { runWithAsyncContext } from '@sentry/node';
import { fetch } from '@whatwg-node/fetch';
import { asyncStorage } from './async-storage';
import type { HiveConfig } from './environment';
import { useArmor } from './use-armor';
import { extractUserId, useSentryUser } from './use-sentry-user';

const reqIdGenerate = hyperid({ fixedLength: true });

const abortControllerCache = new WeakMap();

function hashSessionId(sessionId: string): string {
  return createHash('sha256').update(sessionId).digest('hex');
}

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
  isProduction: boolean;
  hiveConfig: HiveConfig;
  release: string;
  logger: FastifyLoggerInstance;
  persistedOperations: Record<string, DocumentNode | string> | null;
}

export type SuperTokenSessionPayload = zod.TypeOf<typeof SuperTokenAccessTokenModel>;

interface Context extends RegistryContext {
  req: FastifyRequest;
  reply: FastifyReply;
  session: SuperTokenSessionPayload | null;
}

const NoIntrospection: ValidationRule = (context: ValidationContext) => ({
  Field(node) {
    if (node.name.value === '__schema' || node.name.value === '__type') {
      context.reportError(
        new GraphQLError('GraphQL introspection is not allowed', {
          nodes: [node],
        }),
      );
    }
  },
});

function hasFastifyRequest(ctx: unknown): ctx is {
  req: FastifyRequest;
} {
  return !!ctx && typeof ctx === 'object' && 'req' in ctx;
}

function useNoIntrospection(params: {
  signature: string;
  isNonProductionEnvironment: boolean;
}): Plugin<{ req: FastifyRequest }> {
  return {
    onValidate({ context, addValidationRule }) {
      const isReadinessCheck = context.req.headers['x-signature'] === params.signature;
      if (isReadinessCheck || params.isNonProductionEnvironment) {
        return;
      }
      addValidationRule(NoIntrospection);
    },
  };
}

export const graphqlHandler = (options: GraphQLHandlerOptions): RouteHandlerMethod => {
  const { persistedOperations } = options;
  const server = createYoga<Context>({
    logging: options.logger,
    plugins: [
      persistedOperations
        ? usePersistedOperations({
            allowArbitraryOperations: true,
            skipDocumentValidation: true,
            getPersistedOperation(key) {
              return persistedOperations[key] ?? null;
            },
          })
        : {},
      useArmor(),
      useSentry({
        startTransaction: false,
        renameTransaction: false,
        /**
         * When it's not `null`, the plugin modifies the error object.
         * We end up with an unintended error masking, because the GraphQLYogaError is replaced with GraphQLError (without error.originalError).
         */
        eventIdKey: null,
        operationName: () => 'graphql',
        includeRawResult: false,
        includeResolverArgs: false,
        includeExecuteVariables: true,
        configureScope(args, scope) {
          const transaction = scope.getTransaction();

          // Reduce the number of transactions to avoid overloading Sentry
          const ctx = args.contextValue as Context;
          const clientNameHeaderValue = ctx.req.headers['graphql-client-name'];
          const clientName = Array.isArray(clientNameHeaderValue)
            ? clientNameHeaderValue[0]
            : clientNameHeaderValue;

          if (transaction) {
            transaction.setName(`graphql.${args.operationName || 'unknown'}`);
            transaction.setTag('graphql_client_name', clientName ?? 'unknown');
            transaction.sampled = !!clientName && clientName !== 'Hive Client';
          }

          scope.setContext('Extra Info', {
            variables: JSON.stringify(args.variableValues),
            operationName: args.operationName,
            operation: print(args.document),
            userId: extractUserId(args.contextValue as any),
          });
        },
        appendTags: ({ contextValue }) => {
          const supertokens_user_id = extractUserId(contextValue as any);
          const request_id = (contextValue as Context).requestId;

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
      useErrorHandler(({ errors, context }): void => {
        for (const error of errors) {
          if (isGraphQLError(error) && error.originalError) {
            console.log(error);
            console.log(error.originalError);
            continue;
          }

          if (hasFastifyRequest(context)) {
            context.req.log.error(error);
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
              // Everything longer should be treated as a supertokens token (JWT).
              if (accessToken.length > 32) {
                return await verifySuperTokensSession(
                  options.supertokens.connectionUri,
                  options.supertokens.apiKey,
                  accessToken,
                );
              }
            }
          }

          return null;
        },
      }),
      useYogaHive({
        debug: true,
        enabled: !!options.hiveConfig,
        token: options.hiveConfig?.token ?? '',
        usage: {
          endpoint: options.hiveConfig?.usage?.endpoint ?? undefined,
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
          endpoint: options.hiveConfig?.reporting?.endpoint ?? undefined,
          author: 'Hive API',
          commit: options.release,
        },
      }),
      useResponseCache({
        session: request => {
          const sessionValue =
            request.headers.get('authorization') ?? request.headers.get('x-api-token');

          if (sessionValue != null) {
            return hashSessionId(sessionValue);
          }

          return null;
        },
        ttl: 0,
        ttlPerSchemaCoordinate: {
          'Query.tokenInfo': 5_000 /* 5 seconds */,
        },
        invalidateViaMutation: false,
      }),
      useGraphQLModules(options.registry),
      useNoIntrospection({
        signature: options.signature,
        isNonProductionEnvironment: options.isProduction === false,
      }),
    ],
    /*
    graphiql: request =>
      isNonProductionEnvironment ? { endpoint: request.headers.get('x-use-proxy') ?? request.url } : false,
    */
  });

  return async (req, reply) => {
    const requestIdHeader = req.headers['x-request-id'] ?? reqIdGenerate();
    const requestId = cleanRequestId(requestIdHeader);
    let controller = abortControllerCache.get(req.socket);

    // we use the socket.close over req.close because req.close is emitted
    // when the request gets processed (not canceled)
    // see more: https://github.com/nodejs/node/issues/38924
    // TODO: socket.once might break for http/2 because
    if (!controller) {
      controller = new AbortController();
      abortControllerCache.set(req.socket, controller);

      req.raw.socket.once('close', () => {
        controller.abort();
        abortControllerCache.delete(req.socket);
      });
    }

    await asyncStorage.run(
      {
        requestId,
      },
      async () => {
        const response = await runWithAsyncContext(() => {
          return server.handleNodeRequest(req, {
            req,
            reply,
            headers: req.headers,
            requestId,
            session: null,
            abortSignal: controller.signal,
          });
        });

        response.headers.forEach((value, key) => {
          void reply.header(key, value);
        });

        if (!reply.hasHeader('x-request-id')) {
          void reply.header('x-request-id', requestId || '');
        }

        const accept = req.headers.accept;

        if (!accept || accept === '*/*') {
          void reply.header('content-type', 'application/json');
        }

        void reply.status(response.status);

        const textResponse = await response.text();
        return reply.send(textResponse);
      },
    );
  };
};

/**
 * Verify whether a SuperTokens access token session is valid.
 * https://app.swaggerhub.com/apis/supertokens/CDI/2.20#/Session%20Recipe/verifySession
 */
async function verifySuperTokensSession(
  connectionUri: string,
  apiKey: string,
  accessToken: string,
): Promise<SuperTokenSessionPayload> {
  const response = await fetch(connectionUri + '/appid-public/public/recipe/session/verify', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'api-key': apiKey,
      rid: 'session',
      'cdi-version': '3.0',
    },
    body: JSON.stringify({
      accessToken,
      enableAntiCsrf: false,
      doAntiCsrfCheck: false,
      checkDatabase: true,
    }),
  });
  const body = await response.text();
  if (response.status !== 200) {
    console.error(
      `SuperTokens session verification failed with status ${response.status}.\n` + body,
    );
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
