import { createHash } from 'node:crypto';
import type { FastifyBaseLogger, FastifyReply, FastifyRequest, RouteHandlerMethod } from 'fastify';
import { GraphQLError, ValidationContext, ValidationRule } from 'graphql';
import {
  createYoga,
  Plugin,
  useErrorHandler,
  useExecutionCancellation,
  useExtendContext,
} from 'graphql-yoga';
import { isGraphQLError } from '@envelop/core';
import { useGraphQlJit } from '@envelop/graphql-jit';
import { useGraphQLModules } from '@envelop/graphql-modules';
import { useOpenTelemetry } from '@graphql-hive/plugin-opentelemetry';
import { hive, trace } from '@graphql-hive/plugin-opentelemetry/api';
import { useHive } from '@graphql-hive/yoga';
import { useResponseCache } from '@graphql-yoga/plugin-response-cache';
import { Registry, RegistryContext } from '@hive/api';
import { SuperTokensCookieBasedSession } from '@hive/api/modules/auth/lib/supertokens-strategy';
import { requestIdStorage, type TracingInstance } from '@hive/service-common';
import { captureException, runWithAsyncContext, withScope } from '@sentry/node';
import { AuthN, Session } from '../../api/src/modules/auth/lib/authz';
import type { HivePersistedDocumentsConfig, HiveUsageConfig } from './environment';
import { useArmor } from './use-armor';

function hashSessionId(sessionId: string): string {
  return createHash('sha256').update(sessionId).digest('hex');
}

export interface GraphQLHandlerOptions {
  graphiqlEndpoint: string;
  registry: Registry;
  signature: string;
  tracing?: TracingInstance;
  isProduction: boolean;
  hiveUsageConfig: HiveUsageConfig;
  hivePersistedDocumentsConfig: HivePersistedDocumentsConfig;
  release: string;
  logger: FastifyBaseLogger;
  authN: AuthN;
}

export interface Context extends RegistryContext {
  req: FastifyRequest;
  reply: FastifyReply;
  session: Session;
  params?: {
    query: string;
    operationName?: string | null;
  };
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

export function useHiveErrorHandler(unexpectedErrorLogger: (err: unknown) => void): Plugin {
  return useErrorHandler(({ errors, context: unsafeContest, phase }): void => {
    // these are not errors we need to report ever, the user send wrong input
    if (phase === 'parse' || phase === 'validate') {
      return;
    }

    // `contextValue` is present if the error comes up during execution, otherwise the context itself is the context :D
    const context: Context = (unsafeContest.contextValue ?? unsafeContest) as any;

    function reportError(error: Error) {
      withScope(scope => {
        const userId = (context?.session as SuperTokensCookieBasedSession | null | undefined)
          ?.userId;

        scope.setTransactionName(context.params?.operationName ?? 'unknown graphql operation');
        scope.setContext('Extra Info', {
          operationName: context.params?.operationName,
          operation: context.params?.query,
          userId,
        });

        scope.setUser({
          id: userId ?? undefined,
        });

        scope.setTags({
          supertokens_user_id: (
            context?.session as SuperTokensCookieBasedSession | null | undefined
          )?.superTokensUserId,
          hive_user_id: userId,
          request_id: context.requestId,
        });

        if (error instanceof GraphQLError) {
          const path = error.path?.join(' > ') ?? '';

          captureException(error.originalError ?? error, {
            fingerprint: ['graphql', path],
          });
          return;
        }

        captureException(error, {
          fingerprint: ['graphql'],
        });
      });
    }

    try {
      for (const error of errors) {
        // always log the error (this is always the unmasked error)
        context.req.log.error(error);

        if (isGraphQLError(error)) {
          // in this case it is a GraphQL validation error
          // or an expected error we do not need to log/report
          if (!error.originalError || isGraphQLError(error.originalError)) {
            continue;
          }

          context.req.log.error(error.originalError);
          reportError(error);
          continue;
        } else {
          // if the error is not a GraphQL error we should always report.
          reportError(error);
        }
      }
    } catch (err) {
      // this should never never happen - but in case it does we better capture it :)
      captureException(err);
      // in case contextual logging (based on request) is not possible
      unexpectedErrorLogger(err);
      throw err;
    }
  });
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

export function useHiveTracing(): Plugin {
  return {
    onPluginInit({ addPlugin }) {
      addPlugin(
        useOpenTelemetry({
          traces: {
            spans: {
              http: ({ request }) => request.headers.get('x-hive-tracing') !== 'ignore',
            },
          },
        }) as Plugin,
      );
    },
    onParams({ params: { variables }, context }) {
      const otelCtx = hive.getOperationContext(context);
      const operationSpan = otelCtx && trace.getSpan(otelCtx);

      if (operationSpan && variables && typeof variables === 'object' && 'selector' in variables) {
        operationSpan?.setAttribute('hive.variables.selector', JSON.stringify(variables.selector));
      }
    },
  };
}

export const graphqlHandler = (options: GraphQLHandlerOptions): RouteHandlerMethod => {
  const server = createYoga<Context>({
    logging: options.logger,
    plugins: [
      useArmor(),
      useHiveErrorHandler(err => {
        options.logger.error(err, 'Unexpected error occurred while handling exception.');
      }),
      useExtendContext(async context => ({
        session: await options.authN.authenticate(context),
      })),
      useHive({
        debug: true,
        enabled: !!options.hiveUsageConfig,
        token: options.hiveUsageConfig?.token ?? '',
        usage: options.hiveUsageConfig
          ? {
              target: options.hiveUsageConfig.target,
              endpoint: options.hiveUsageConfig.endpoint ?? undefined,
              fieldLevelMetricsEnabled: options.hiveUsageConfig.fieldLevelMetricsEnabled,
              clientInfo(ctx: { req: FastifyRequest; reply: FastifyReply }) {
                const name = ctx.req.headers['graphql-client-name'] as string;
                const version = (ctx.req.headers['graphql-client-version'] as string) ?? 'missing';

                if (name) {
                  return { name, version };
                }

                return null;
              },
              exclude: ['readiness'],
            }
          : false,
        persistedDocuments: options.hivePersistedDocumentsConfig
          ? {
              cdn: {
                endpoint: options.hivePersistedDocumentsConfig.cdnEndpoint,
                accessToken: options.hivePersistedDocumentsConfig.cdnAccessKeyId,
              },
              allowArbitraryDocuments: true,
              cache: 50_000,
            }
          : undefined,
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
      useGraphQlJit(
        {},
        {
          enableIf(args) {
            if (hasFastifyRequest(args.contextValue)) {
              // Enable JIT only for Hive App
              const name = args.contextValue.req.headers['graphql-client-name'] as string;

              return name === 'Hive App';
            }

            return false;
          },
          onError(r) {
            options.logger.error(r);
          },
        },
      ),
      options.tracing ? useHiveTracing() : {},
      useExecutionCancellation(),
    ],
    graphiql: !options.isProduction,
  });

  return async (req, reply) => {
    const requestId = req.id;

    await requestIdStorage.run(
      {
        requestId,
      },
      async () => {
        const response = await runWithAsyncContext(() => {
          return server.handleNodeRequestAndResponse(req, reply, {
            req,
            reply,
            headers: req.headers,
            requestId,
          });
        });

        response.headers.forEach((value, key) => {
          void reply.header(key, value);
        });

        const accept = req.headers.accept;

        if (!accept || accept === '*/*') {
          void reply.header('content-type', 'application/json');
        }

        void reply.status(response.status);
        void reply.send(response.body);

        return reply;
      },
    );
  };
};
