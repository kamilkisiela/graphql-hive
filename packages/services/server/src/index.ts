#!/usr/bin/env node
import got from 'got';
import { GraphQLError, stripIgnoredCharacters } from 'graphql';
import supertokens from 'supertokens-node';
import {
  errorHandler as supertokensErrorHandler,
  plugin as supertokensFastifyPlugin,
} from 'supertokens-node/framework/fastify/index.js';
import cors from '@fastify/cors';
import type { FastifyCorsOptionsDelegateCallback } from '@fastify/cors';
import { createRedisEventTarget } from '@graphql-yoga/redis-event-target';
import 'reflect-metadata';
import { hostname } from 'os';
import { createPubSub } from 'graphql-yoga';
import { z } from 'zod';
import formDataPlugin from '@fastify/formbody';
import { createRegistry, createTaskRunner, CryptoProvider, LogFn, Logger } from '@hive/api';
import { HivePubSub } from '@hive/api/src/modules/shared/providers/pub-sub';
import { createRedisClient } from '@hive/api/src/modules/shared/providers/redis';
import { createArtifactRequestHandler } from '@hive/cdn-script/artifact-handler';
import { ArtifactStorageReader } from '@hive/cdn-script/artifact-storage-reader';
import { AwsClient } from '@hive/cdn-script/aws';
import { createIsAppDeploymentActive } from '@hive/cdn-script/is-app-deployment-active';
import { createIsKeyValid } from '@hive/cdn-script/key-validation';
import {
  configureTracing,
  createServer,
  registerShutdown,
  registerTRPC,
  reportReadiness,
  startMetrics,
  traceInline,
  TracingInstance,
} from '@hive/service-common';
import { createConnectionString, createStorage as createPostgreSQLStorage } from '@hive/storage';
import {
  contextLinesIntegration,
  dedupeIntegration,
  extraErrorDataIntegration,
} from '@sentry/integrations';
import {
  captureException,
  httpIntegration,
  init,
  linkedErrorsIntegration,
  SeverityLevel,
} from '@sentry/node';
import { createServerAdapter } from '@whatwg-node/server';
import { createContext, internalApiRouter } from './api';
import { asyncStorage } from './async-storage';
import { env } from './environment';
import { graphqlHandler } from './graphql-handler';
import { clickHouseElapsedDuration, clickHouseReadDuration } from './metrics';
import { initSupertokens, oidcIdLookup } from './supertokens';

export async function main() {
  let tracing: TracingInstance | undefined;

  if (env.tracing.enabled && env.tracing.collectorEndpoint) {
    tracing = configureTracing({
      collectorEndpoint: env.tracing.collectorEndpoint,
      serviceName: 'graphql-api',
      enableConsoleExporter: env.tracing.enableConsoleExporter,
    });

    tracing.instrumentNodeFetch();
    tracing.build();
    tracing.start();
  }

  init({
    serverName: hostname(),
    dist: 'server',
    enabled: !!env.sentry,
    environment: env.environment,
    dsn: env.sentry?.dsn,
    enableTracing: false,
    tracesSampleRate: 1,
    ignoreTransactions: [
      'POST /graphql', // Transaction created for a cached response (@graphql-yoga/plugin-response-cache)
    ],
    release: env.release,
    integrations: [
      httpIntegration({ tracing: false }),
      contextLinesIntegration({
        frameContextLines: 0,
      }),
      linkedErrorsIntegration(),
      extraErrorDataIntegration({
        depth: 2,
      }),
      dedupeIntegration(),
    ],
    maxBreadcrumbs: 10,
    defaultIntegrations: false,
    autoSessionTracking: false,
  });

  const server = await createServer({
    name: 'graphql-api',
    sentryErrorHandler: true,
    cors: false,
    log: {
      level: env.log.level,
      requests: env.log.requests,
    },
  });

  if (tracing) {
    await server.register(...tracing.instrumentFastify());
  }

  server.addContentTypeParser(
    'application/graphql+json',
    { parseAs: 'string' },
    function parseApplicationGraphQLJsonPayload(_req, payload, done) {
      done(null, JSON.parse(payload as unknown as string));
    },
  );

  server.addContentTypeParser(
    'application/graphql',
    { parseAs: 'string' },
    function parseApplicationGraphQLPayload(_req, payload, done) {
      done(null, {
        query: payload,
      });
    },
  );

  server.setErrorHandler(supertokensErrorHandler());
  await server.register(cors, (_: unknown): FastifyCorsOptionsDelegateCallback => {
    return (req, callback) => {
      if (req.headers.origin?.startsWith(env.hiveServices.webApp.url)) {
        // We need to treat requests from the web app a bit differently than others.
        // The web app requires to define the `Access-Control-Allow-Origin` header (not *).
        callback(null, {
          origin: env.hiveServices.webApp.url,
          credentials: true,
          methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
          allowedHeaders: [
            'Content-Type',
            'graphql-client-version',
            'graphql-client-name',
            'x-request-id',
            ...supertokens.getAllCORSHeaders(),
          ],
        });
        return;
      }

      callback(null, {});
    };
  });

  const storage = await createPostgreSQLStorage(
    createConnectionString(env.postgres),
    10,
    tracing ? [tracing.instrumentSlonik()] : [],
  );

  const redis = createRedisClient('Redis', env.redis, server.log.child({ source: 'Redis' }));

  const pubSub = createPubSub({
    eventTarget: createRedisEventTarget({
      publishClient: redis,
      subscribeClient: createRedisClient(
        'subscriber',
        env.redis,
        server.log.child({ source: 'RedisSubscribe' }),
      ),
    }),
  }) as HivePubSub;

  let dbPurgeTaskRunner: null | ReturnType<typeof createTaskRunner> = null;

  if (!env.hiveServices.usageEstimator) {
    server.log.debug('Usage estimation is disabled. Skip scheduling purge tasks.');
  } else {
    server.log.debug(
      `Usage estimation is enabled. Start scheduling purge tasks every ${env.hiveServices.usageEstimator.dateRetentionPurgeIntervalMinutes} minutes.`,
    );
    dbPurgeTaskRunner = createTaskRunner({
      run: traceInline(
        'Purge Task',
        {
          resultAttributes: result => ({
            'purge.schema.check.count': result.deletedSchemaCheckCount,
            'purge.sdl.store.count': result.deletedSdlStoreCount,
            'purge.change.approval.count': result.deletedSchemaChangeApprovalCount,
            'purge.contract.approval.count': result.deletedContractSchemaChangeApprovalCount,
          }),
        },
        async () => {
          try {
            const result = await storage.purgeExpiredSchemaChecks({
              expiresAt: new Date(),
            });
            server.log.debug(
              'Finished running schema check purge task. (deletedSchemaCheckCount=%s deletedSdlStoreCount=%s)',
              result.deletedSchemaCheckCount,
              result.deletedSdlStoreCount,
            );

            return result;
          } catch (error) {
            captureException(error);
            throw error;
          }
        },
      ),
      interval: env.hiveServices.usageEstimator.dateRetentionPurgeIntervalMinutes * 60 * 1000,
      logger: server.log,
    });

    dbPurgeTaskRunner.start();
  }

  registerShutdown({
    logger: server.log,
    async onShutdown() {
      server.log.info('Stopping tracing handler...');
      await tracing?.shutdown();
      server.log.info('Stopping HTTP server listener...');
      await server.close();
      server.log.info('Stopping Storage handler...');
      await storage.destroy();
      if (dbPurgeTaskRunner) {
        server.log.info('Stopping expired schema check purge task...');
        await dbPurgeTaskRunner.stop();
      }
      server.log.info('Shutdown complete.');
    },
  });

  function createErrorHandler(level: SeverityLevel): LogFn {
    return (error: any, errorLike?: any, ...args: any[]) => {
      server.log.error(error, errorLike, ...args);

      const errorObj =
        error instanceof Error ? error : errorLike instanceof Error ? errorLike : null;

      if (errorObj instanceof GraphQLError) {
        return;
      }

      if (errorObj instanceof Error) {
        captureException(errorObj, {
          level,
          extra: {
            error,
            errorLike,
            rest: args,
          },
        });
      }
    };
  }

  function getRequestId() {
    const store = asyncStorage.getStore();

    return store?.requestId;
  }

  function wrapLogFn(fn: LogFn): LogFn {
    return (msg, ...args) => {
      const requestId = getRequestId();

      if (requestId) {
        fn(msg + ` - (requestId=${requestId})`, ...args);
      } else {
        fn(msg, ...args);
      }
    };
  }

  try {
    const errorHandler = createErrorHandler('error');
    const fatalHandler = createErrorHandler('fatal');

    function createGraphQLLogger(binds: Record<string, any> = {}): Logger {
      return {
        error: wrapLogFn(errorHandler),
        fatal: wrapLogFn(fatalHandler),
        info: wrapLogFn(server.log.info.bind(server.log)),
        warn: wrapLogFn(server.log.warn.bind(server.log)),
        trace: wrapLogFn(server.log.trace.bind(server.log)),
        debug: wrapLogFn(server.log.debug.bind(server.log)),
        child(bindings) {
          return createGraphQLLogger({
            ...binds,
            ...bindings,
            requestId: getRequestId(),
          });
        },
      };
    }
    const logger = createGraphQLLogger();
    const registry = createRegistry({
      app: env.hiveServices.webApp
        ? {
            baseUrl: env.hiveServices.webApp.url,
          }
        : null,
      tokens: {
        endpoint: env.hiveServices.tokens.endpoint,
      },
      billing: {
        endpoint: env.hiveServices.billing ? env.hiveServices.billing.endpoint : null,
      },
      emailsEndpoint: env.hiveServices.emails ? env.hiveServices.emails.endpoint : undefined,
      webhooks: {
        endpoint: env.hiveServices.webhooks.endpoint,
      },
      schemaService: {
        endpoint: env.hiveServices.schema.endpoint,
      },
      usageEstimationService: {
        endpoint: env.hiveServices.usageEstimator ? env.hiveServices.usageEstimator.endpoint : null,
      },
      rateLimitService: {
        endpoint: env.hiveServices.rateLimit ? env.hiveServices.rateLimit.endpoint : null,
      },
      schemaPolicyService: {
        endpoint: env.hiveServices.schemaPolicy ? env.hiveServices.schemaPolicy.endpoint : null,
      },
      logger,
      storage,
      redis,
      githubApp: env.github,
      clickHouse: {
        protocol: env.clickhouse.protocol,
        host: env.clickhouse.host,
        port: env.clickhouse.port,
        username: env.clickhouse.username,
        password: env.clickhouse.password,
        requestTimeout: env.clickhouse.requestTimeout,
        onReadEnd(query, timings) {
          clickHouseReadDuration.labels({ query }).observe(timings.totalSeconds);

          if (timings.elapsedSeconds !== undefined) {
            clickHouseElapsedDuration.labels({ query }).observe(timings.elapsedSeconds);
          }
        },
      },
      cdn: env.cdn,
      s3: {
        accessKeyId: env.s3.credentials.accessKeyId,
        secretAccessKeyId: env.s3.credentials.secretAccessKey,
        sessionToken: env.s3.credentials.sessionToken,
        bucketName: env.s3.bucketName,
        endpoint: env.s3.endpoint,
      },
      s3Mirror: env.s3Mirror
        ? {
            accessKeyId: env.s3Mirror.credentials.accessKeyId,
            secretAccessKeyId: env.s3Mirror.credentials.secretAccessKey,
            sessionToken: env.s3Mirror.credentials.sessionToken,
            bucketName: env.s3Mirror.bucketName,
            endpoint: env.s3Mirror.endpoint,
          }
        : null,
      encryptionSecret: env.encryptionSecret,
      feedback: {
        token: 'noop',
        channel: 'noop',
      },
      schemaConfig: env.hiveServices.webApp
        ? {
            schemaPublishLink(input) {
              let url = `${env.hiveServices.webApp.url}/${input.organization.slug}/${input.project.slug}/${input.target.slug}`;

              if (input.version) {
                url += `/history/${input.version.id}`;
              }

              return url;
            },
            schemaCheckLink(input) {
              return `${env.hiveServices.webApp.url}/${input.organization.slug}/${input.project.slug}/${input.target.slug}/checks/${input.schemaCheckId}`;
            },
          }
        : {},
      organizationOIDC: env.organizationOIDC,
      supportConfig: env.zendeskSupport,
      pubSub,
      appDeploymentsEnabled: env.featureFlags.appDeploymentsEnabled,
    });

    const graphqlPath = '/graphql';
    const port = env.http.port;
    const signature = Math.random().toString(16).substr(2);
    const graphql = graphqlHandler({
      graphiqlEndpoint: graphqlPath,
      registry,
      signature,
      supertokens: {
        connectionUri: env.supertokens.connectionURI,
        apiKey: env.supertokens.apiKey,
      },
      isProduction: env.environment === 'prod',
      release: env.release,
      hiveConfig: env.hive,
      hivePersistedDocumentsConfig: env.hivePersistedDocuments,
      tracing,
      logger: logger as any,
    });

    server.route({
      method: ['GET', 'POST'],
      url: graphqlPath,
      handler: graphql,
    });

    const introspection = JSON.stringify({
      query: stripIgnoredCharacters(/* GraphQL */ `
        query readiness {
          __schema {
            queryType {
              name
            }
          }
        }
      `),
      operationName: 'readiness',
    });

    const crypto = new CryptoProvider(env.encryptionSecret);

    initSupertokens({
      storage,
      crypto,
      logger: server.log,
      broadcastLog(id, message) {
        pubSub.publish('oidcIntegrationLogs', id, {
          timestamp: new Date().toISOString(),
          message,
        });
      },
    });

    await server.register(formDataPlugin);
    await server.register(supertokensFastifyPlugin);

    await registerTRPC(server, {
      router: internalApiRouter,
      createContext() {
        return createContext({ storage, crypto });
      },
    });

    server.route({
      method: ['GET', 'HEAD'],
      url: '/_health',
      async handler(_, res) {
        res.status(200).send(); // eslint-disable-line @typescript-eslint/no-floating-promises -- false positive, FastifyReply.then returns void
      },
    });

    server.route({
      method: ['GET', 'HEAD'],
      url: '/_readiness',
      async handler(req, res) {
        try {
          const [response, storageIsReady] = await Promise.all([
            got.post(`http://0.0.0.0:${port}${graphqlPath}?readiness=true`, {
              method: 'POST',
              body: introspection,
              headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                'x-signature': signature,
              },
            }),
            storage.isReady(),
          ]);

          if (!storageIsReady) {
            req.log.error('Readiness check failed: failed to connect to Postgres');
          } else if (response.statusCode !== 200 || !response.body.includes('"__schema"')) {
            req.log.error(`Readiness check failed: [${response.statusCode}] ${response.body}`);
          } else {
            reportReadiness(true);
            res.status(200).send(); // eslint-disable-line @typescript-eslint/no-floating-promises -- false positive, FastifyReply.then returns void
            return;
          }
        } catch (error) {
          req.log.error(error);
        }

        reportReadiness(false);
        res.status(400).send(); // eslint-disable-line @typescript-eslint/no-floating-promises -- false positive, FastifyReply.then returns void
      },
    });

    const oidcIdLookupSchema = z.object({
      slug: z.string({
        required_error: 'Slug is required',
      }),
    });
    server.post('/auth-api/oidc-id-lookup', async (req, res) => {
      const inputResult = oidcIdLookupSchema.safeParse(req.body);

      if (!inputResult.success) {
        captureException(inputResult.error, {
          extra: {
            path: '/auth-api/oidc-id-lookup',
            body: req.body,
          },
        });
        void res.status(400).send({
          ok: false,
          title: 'Invalid input',
          description: 'Failed to resolve SSO information due to invalid input.',
          status: 400,
        } satisfies Awaited<ReturnType<typeof oidcIdLookup>>);
        return;
      }

      const result = await oidcIdLookup(inputResult.data.slug, storage, req.log);

      if (result.ok) {
        void res.status(200).send(result);
        return;
      }

      void res.status(result.status).send(result);
      return;
    });

    if (env.cdn.providers.api !== null) {
      const s3 = {
        client: new AwsClient({
          accessKeyId: env.s3.credentials.accessKeyId,
          secretAccessKey: env.s3.credentials.secretAccessKey,
          service: 's3',
        }),
        endpoint: env.s3.endpoint,
        bucketName: env.s3.bucketName,
      };

      const s3Mirror = env.s3Mirror
        ? {
            client: new AwsClient({
              accessKeyId: env.s3Mirror.credentials.accessKeyId,
              secretAccessKey: env.s3Mirror.credentials.secretAccessKey,
              service: 's3',
            }),
            endpoint: env.s3Mirror.endpoint,
            bucketName: env.s3Mirror.bucketName,
          }
        : null;

      const artifactStorageReader = new ArtifactStorageReader(s3, s3Mirror, null, null);

      const artifactHandler = createArtifactRequestHandler({
        isKeyValid: createIsKeyValid({
          artifactStorageReader,
          analytics: null,
          breadcrumb(message: string) {
            server.log.debug(message);
          },
          getCache: null,
          waitUntil: null,
          captureException(error) {
            captureException(error, {
              extra: {
                source: 'artifactRequestHandler',
              },
            });
          },
        }),
        artifactStorageReader,
        isAppDeploymentActive: createIsAppDeploymentActive({
          artifactStorageReader,
          getCache: null,
          waitUntil: null,
        }),
      });
      const artifactRouteHandler = createServerAdapter(
        // TODO: remove `as any` once the fallback logic in packages/services/cdn-worker/src/artifact-handler.ts is removed
        artifactHandler as any,
      );

      /** Artifacts API */
      server.route({
        method: ['GET'],
        url: '/artifacts/v1/*',
        async handler(req, reply) {
          const response = await artifactRouteHandler.handleNodeRequest(req);

          if (response === undefined) {
            void reply.status(404).send('Not found.');
            return reply;
          }

          response.headers.forEach((value, key) => {
            void reply.header(key, value);
          });

          void reply.status(response.status);

          const textResponse = await response.text();
          void reply.send(textResponse);
        },
      });
    }

    if (env.prometheus) {
      await startMetrics(env.prometheus.labels.instance, env.prometheus.port);
    }

    await server.listen({
      port: env.http.port,
      host: '::',
    });
  } catch (error) {
    server.log.fatal(error);
    captureException(error, {
      level: 'fatal',
    });
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
