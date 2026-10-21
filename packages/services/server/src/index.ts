#!/usr/bin/env node
import got from 'got';
import { GraphQLError, stripIgnoredCharacters } from 'graphql';
import cors from '@fastify/cors';
import type { FastifyCorsOptionsDelegateCallback } from '@fastify/cors';
import 'reflect-metadata';
import formDataPlugin from '@fastify/formbody';
import {
  ClickHouse,
  createRegistry,
  HttpClient,
  LogFn,
  Logger,
  OrganizationMemberRoles,
  OrganizationMembers,
} from '@hive/api';
import { AccessTokenKeyContainer } from '@hive/api/modules/auth/lib/supertokens-at-home/crypto';
import { EmailVerification } from '@hive/api/modules/auth/providers/email-verification';
import { OAuthCache } from '@hive/api/modules/auth/providers/oauth-cache';
import { createDefaultCredentialProvider } from '@hive/api/modules/cdn/providers/aws';
import { OIDCIntegrationConfig } from '@hive/api/modules/oidc-integrations/providers/oidc-integration-config';
import { OIDCIntegrationStore } from '@hive/api/modules/oidc-integrations/providers/oidc-integration.store';
import { RedisRateLimiter } from '@hive/api/modules/shared/providers/redis-rate-limiter';
import { TargetsByIdCache } from '@hive/api/modules/target/providers/targets-by-id-cache';
import { TargetsBySlugCache } from '@hive/api/modules/target/providers/targets-by-slug-cache';
import { createArtifactRequestHandler } from '@hive/cdn-script/artifact-handler';
import { ArtifactStorageReader } from '@hive/cdn-script/artifact-storage-reader';
import { AwsClient } from '@hive/cdn-script/aws';
import { createIsAppDeploymentActive } from '@hive/cdn-script/is-app-deployment-active';
import { createIsKeyValid } from '@hive/cdn-script/key-validation';
import { createConnectionStringProvider } from '@hive/postgres';
import { createHivePubSub } from '@hive/pubsub';
import {
  configureTracing,
  createRedisClient,
  createServer,
  Encryptor,
  generateRdsIamAuthToken,
  getRequestId,
  registerShutdown,
  registerTRPC,
  reportReadiness,
  sentryInit,
  startMetrics,
  TracingInstance,
} from '@hive/service-common';
import { createStorage as createPostgreSQLStorage } from '@hive/storage';
import { TaskScheduler } from '@hive/workflows/kit';
import { captureException, SeverityLevel } from '@sentry/node';
import { createServerAdapter } from '@whatwg-node/server';
import { AuthN } from '../../api/src/modules/auth/lib/authz';
import { OrganizationAccessTokenStrategy } from '../../api/src/modules/auth/lib/organization-access-token-strategy';
import { SuperTokensUserAuthNStrategy } from '../../api/src/modules/auth/lib/supertokens-strategy';
import { TargetAccessTokenStrategy } from '../../api/src/modules/auth/lib/target-access-token-strategy';
import { OrganizationAccessTokenValidationCache } from '../../api/src/modules/auth/providers/organization-access-token-validation-cache';
import { OrganizationAccessTokensCache } from '../../api/src/modules/organization/providers/organization-access-tokens-cache';
import { TargetTokenCache } from '../../api/src/modules/token/providers/target-token-cache';
import { internalApiRouter } from './api';
import { CorsError } from './cors-error';
import { env } from './environment';
import { graphqlHandler } from './graphql-handler';
import { clickHouseElapsedDuration, clickHouseReadDuration } from './metrics';
import { createOtelAuthEndpoint } from './otel-auth-endpoint';
import { createPublicGraphQLHandler } from './public-graphql-handler';
import { createSCIMPlugin } from './scim';
import { registerSupertokensAtHome } from './supertokens-at-home';
import { WorkloadIdentityFederationProvider } from './workload-identity-federation';

export async function main() {
  let tracing: TracingInstance | undefined;

  if (env.tracing.enabled) {
    tracing = configureTracing({
      collectorEndpoint: env.tracing.collectorEndpoint,
      serviceName: 'graphql-api',
      enableConsoleExporter: env.tracing.enableConsoleExporter,
      hiveTracing: env.tracing.hive,
    });

    tracing.instrumentNodeFetch();
    tracing.setup();
  }

  if (env.sentry) {
    sentryInit({
      dist: 'server',
      enabled: !!env.sentry,
      environment: env.environment,
      dsn: env.sentry.dsn,
      release: env.release,
    });
  }

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

  await server.register(cors, (_: unknown): FastifyCorsOptionsDelegateCallback => {
    return (req, callback) => {
      // For CLI user we do not have a origin
      if (req.headers.origin == null) {
        // this is the easiest way to omit all cors headers for our version of the cors plugin.
        return callback(null, {
          origin: [],
        });
      }

      if (req.headers.origin !== env.hiveServices.webApp.url) {
        return callback(new CorsError());
      }

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
          'ignore-session',
          'x-request-id',
          'rid',
          'fdi-version',
          'anti-csrf',
          'authorization',
          'st-auth-mode',
        ],
      });
    };
  });

  const rdsIamTokenGenerator = env.postgres.awsIamAuthEnabled
    ? () =>
        generateRdsIamAuthToken(
          {
            region: env.postgres.awsRegion ?? '',
            hostname: env.postgres.host,
            port: env.postgres.port,
            username: env.postgres.user,
          },
          server.log.child({ source: 'RdsIamAuthTokenGenerator' }),
        )
    : undefined;

  const storage = await createPostgreSQLStorage(
    createConnectionStringProvider(env.postgres, rdsIamTokenGenerator),
    10,
    tracing ? [tracing.instrumentSlonik()] : [],
  );
  const taskScheduler = new TaskScheduler(storage.pool);

  const workloadIdentityFederation = env.oidcWorkloadFederation
    ? new WorkloadIdentityFederationProvider(
        env.oidcWorkloadFederation.tokenFilePath,
        server.log.child({ source: 'WorkloadIdentityFederation' }),
      )
    : null;

  if (workloadIdentityFederation) {
    await workloadIdentityFederation.start();
  }

  const redis = await createRedisClient(env.redis, {
    logger: server.log.child({ source: 'Redis' }),
  });

  const redisSubscriber = await createRedisClient(env.redis, {
    logger: server.log.child({ source: 'RedisSubscribe' }),
  });

  const pubSub = createHivePubSub({
    publisher: redis,
    subscriber: redisSubscriber,
  });

  registerShutdown({
    logger: server.log,
    async onShutdown() {
      server.log.info('Stopping tracing handler...');
      await tracing?.shutdown();
      server.log.info('Stopping HTTP server listener...');
      await server.close();
      server.log.info('Stopping Storage handler...');
      await storage.destroy();
      workloadIdentityFederation?.stop();
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
            rateLimit: env.supertokens.rateLimit,
          }
        : null,
      commerce: {
        endpoint: env.hiveServices.commerce ? env.hiveServices.commerce.endpoint : null,
        billingEnabled: env.hiveServices.commerce ? env.hiveServices.commerce.billing : false,
      },
      schemaService: {
        endpoint: env.hiveServices.schema.endpoint,
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
        database: env.clickhouse.database,
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
        credentialProvider: createDefaultCredentialProvider({
          label: 's3',
          logger,
          staticCredentials: env.s3.credentials,
          awsIamAuthEnabled: env.s3.awsIamAuthEnabled,
        }),
        bucketName: env.s3.bucketName,
        endpoint: env.s3.endpoint,
      },
      s3Mirror: env.s3Mirror
        ? {
            credentialProvider: createDefaultCredentialProvider({
              label: 's3mirror',
              logger,
              staticCredentials: env.s3Mirror.credentials,
              awsIamAuthEnabled: env.s3Mirror.awsIamAuthEnabled,
            }),
            bucketName: env.s3Mirror.bucketName,
            endpoint: env.s3Mirror.endpoint,
          }
        : null,
      s3AuditLogs: env.s3AuditLogs
        ? {
            credentialProvider: createDefaultCredentialProvider({
              label: 's3audit',
              logger,
              staticCredentials: env.s3AuditLogs.credentials,
              awsIamAuthEnabled: env.s3AuditLogs.awsIamAuthEnabled,
            }),
            bucketName: env.s3AuditLogs.bucketName,
            endpoint: env.s3AuditLogs.endpoint,
          }
        : null,
      encryptionSecret: env.encryptionSecret,
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
      oidcIntegrationConfig: new OIDCIntegrationConfig(env.organizationOIDC, env.organizationSCIM),
      supportConfig: env.zendeskSupport,
      pubSub,
      appDeploymentsEnabled: env.featureFlags.appDeploymentsEnabled,
      schemaProposalsEnabled: env.featureFlags.schemaProposalsEnabled,
      otelTracingEnabled: env.featureFlags.otelTracingEnabled,
      metricAlertRulesEnabled: env.featureFlags.metricAlertRulesEnabled,
      prometheus: env.prometheus,
      taskScheduler,
    });

    const organizationAccessTokenStrategy = (logger: Logger) =>
      new OrganizationAccessTokenStrategy({
        logger,
        organizationAccessTokensCache: registry.injector.get(OrganizationAccessTokensCache),
        organizationAccessTokenValidationCache: registry.injector.get(
          OrganizationAccessTokenValidationCache,
        ),
      });

    const graphqlPath = '/graphql';
    const port = env.http.port;
    const signature = Math.random().toString(16).substr(2);
    const graphql = graphqlHandler({
      graphiqlEndpoint: graphqlPath,
      registry,
      signature,
      isProduction: env.environment !== 'development',
      release: env.release,
      hiveUsageConfig: env.hive,
      hivePersistedDocumentsConfig: env.hivePersistedDocuments,
      tracing,
      logger: logger as any,
      authN: new AuthN({
        strategies: [
          (logger: Logger) =>
            new SuperTokensUserAuthNStrategy({
              logger,
              storage,
              organizationMembers: new OrganizationMembers(
                storage.pool,
                new OrganizationMemberRoles(storage.pool, logger),
                logger,
              ),
              emailVerification: env.auth.requireEmailVerification
                ? registry.injector.get(EmailVerification)
                : null,
              accessTokenKey: new AccessTokenKeyContainer(env.supertokens.secrets.accessTokenKey),
              oidcIntegrationStore: new OIDCIntegrationStore(storage.pool, redis, logger),
              superadminForeignOrganizationActions: env.auth.superadminForeignOrganizationActions,
              superadminOrganizationId: env.auth.superadminOrganizationId,
            }),
          organizationAccessTokenStrategy,
          (logger: Logger) =>
            new TargetAccessTokenStrategy({
              logger,
              cache: registry.injector.get(TargetTokenCache),
            }),
        ],
      }),
    });

    server.route({
      method: ['GET', 'POST'],
      url: graphqlPath,
      handler: graphql,
    });

    const authN = new AuthN({
      strategies: [organizationAccessTokenStrategy],
    });

    server.route({
      method: ['GET', 'POST'],
      url: '/graphql-public',
      handler: createPublicGraphQLHandler({
        registry,
        logger: logger as any,
        hiveUsageConfig: env.hive,
        authN,
        tracing,
      }),
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

    const crypto = new Encryptor(env.encryptionSecret);

    function broadcastLog(oidcId: string, message: string) {
      pubSub.publish('oidcIntegrationLogs', oidcId, {
        timestamp: new Date().toISOString(),
        message,
      });
    }

    await server.register(formDataPlugin);

    await registerTRPC(server, {
      router: internalApiRouter,
      createContext() {
        return {
          storage,
          crypto,
        };
      },
    });

    server.route({
      method: ['GET', 'HEAD'],
      url: '/_health',
      async handler(_, res) {
        void res.status(200).send();
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
                'x-hive-tracing': 'ignore',
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
            void res.status(200).send();
            return;
          }
        } catch (error) {
          req.log.error(error);
        }

        reportReadiness(false);
        void res.status(400).send();
      },
    });

    createOtelAuthEndpoint({
      server,
      authN,
      targetsBySlugCache: registry.injector.get(TargetsBySlugCache),
      targetsByIdCache: registry.injector.get(TargetsByIdCache),
    });

    server.post('/cache/organization-access-token-cache/delete/:id', async (req, res) => {
      void res.status(200).send({
        deleted: await registry.injector
          .get(OrganizationAccessTokensCache)
          .purge({ id: (req.params as any).id }),
      });
      return;
    });

    await registerSupertokensAtHome(
      server,
      storage,
      registry.injector.get(OIDCIntegrationStore),
      registry.injector.get(TaskScheduler),
      registry.injector.get(Encryptor),
      registry.injector.get(RedisRateLimiter),
      registry.injector.get(OAuthCache),
      broadcastLog,
      env.supertokens.secrets,
      workloadIdentityFederation,
      env.organizationSCIM,
    );

    if (env.cdn.providers.api !== null) {
      const s3 = {
        client: new AwsClient({
          credentialProvider: createDefaultCredentialProvider({
            label: 'cdn-s3',
            logger,
            staticCredentials: env.s3.credentials,
            awsIamAuthEnabled: env.s3.awsIamAuthEnabled,
          }),
          service: 's3',
        }),
        endpoint: env.s3.endpoint,
        bucketName: env.s3.bucketName,
      };

      const s3Mirror = env.s3Mirror
        ? {
            client: new AwsClient({
              credentialProvider: createDefaultCredentialProvider({
                label: 'cdn-s3mirror',
                logger,
                staticCredentials: env.s3Mirror.credentials,
                awsIamAuthEnabled: env.s3Mirror.awsIamAuthEnabled,
              }),
              service: 's3',
            }),
            endpoint: env.s3Mirror.endpoint,
            bucketName: env.s3Mirror.bucketName,
          }
        : null;

      const artifactStorageReader = new ArtifactStorageReader(s3, s3Mirror, null, null);

      const artifactHandler = createArtifactRequestHandler({
        isKeyValid: createIsKeyValid({
          kvStorageBaseUrl: env.cdn.providers.api.kv?.baseUrl,
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

    const scimPlugin = createSCIMPlugin(
      authN,
      storage.pool,
      storage,
      registry.injector.get(OIDCIntegrationStore),
      registry.injector.get(RedisRateLimiter),
      new ClickHouse(env.clickhouse, new HttpClient(), logger),
      env.graphql.origin + '/scim/v2',
      env.organizationSCIM,
    );
    await server.register(scimPlugin, { prefix: '/scim/v2' });

    if (env.exposeMemoryUtils) {
      logger.debug('exposing memory utils endpoints');
      server.route({
        method: ['GET'],
        url: '/memory-stats',
        handler(req, reply) {
          let mem = process.memoryUsage();
          logger.debug('memory stats requested, raw memory usage', mem);

          void reply.send({
            heapTotal: mem.heapTotal,
            heapUsed: mem.heapUsed,
            external: mem.external,
            rss: mem.rss,
          });
        },
      });

      server.route({
        method: ['POST'],
        url: '/gc',
        handler(req, reply) {
          const gc = global.gc;
          if (!gc) {
            logger.debug('gc requested but not available');
            void reply.status(500);
            void reply.send('gc not available');
            return;
          }

          logger.debug('gc requested');
          // A single collection leaves memory behind that the next pass frees (compilation cache,
          // weak lists, deferred frees), so collect until the heap stops shrinking and report the
          // usage measured right after the final pass, before this handler allocates anything else.
          const maxPasses = 10;
          const stableThresholdBytes = 16 * 1024;
          let passes = 0;
          let previousHeapUsed = Number.POSITIVE_INFINITY;
          let mem = process.memoryUsage();
          while (passes < maxPasses) {
            gc({ type: 'major', execution: 'sync', flavor: 'last-resort' });
            passes++;
            mem = process.memoryUsage();
            if (Math.abs(previousHeapUsed - mem.heapUsed) < stableThresholdBytes) {
              break;
            }
            previousHeapUsed = mem.heapUsed;
          }
          logger.debug('gc completed after %d passes, raw memory usage: %j', passes, mem);

          void reply.send({
            heapTotal: mem.heapTotal,
            heapUsed: mem.heapUsed,
            external: mem.external,
            rss: mem.rss,
            passes,
          });
        },
      });
    }

    if (env.prometheus) {
      await startMetrics(env.prometheus.labels.instance, {
        port: env.prometheus.port,
        host: env.http.host,
        ipv6Only: env.http.ipv6Only,
      });
    }

    await server.listen({
      port: env.http.port,
      host: env.http.host,
      ipv6Only: env.http.ipv6Only,
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
