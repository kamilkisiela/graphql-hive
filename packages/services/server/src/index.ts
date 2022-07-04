#!/usr/bin/env node

import 'reflect-metadata';
import { createServer, startMetrics, ensureEnv, registerShutdown, reportReadiness } from '@hive/service-common';
import { createRegistry, LogFn, Logger } from '@hive/api';
import { createStorage as createPostgreSQLStorage, createConnectionString } from '@hive/storage';
import got from 'got';
import { stripIgnoredCharacters } from 'graphql';
import * as Sentry from '@sentry/node';
import { Dedupe, ExtraErrorData } from '@sentry/integrations';
import { asyncStorage } from './async-storage';
import { graphqlHandler } from './graphql-handler';
import { clickHouseReadDuration, clickHouseElapsedDuration } from './metrics';

export async function main() {
  Sentry.init({
    serverName: 'api',
    enabled: process.env.ENVIRONMENT === 'prod',
    environment: process.env.ENVIRONMENT,
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 1,
    tracesSampler() {
      return 1;
    },
    release: process.env.RELEASE || 'local',
    integrations: [
      new Sentry.Integrations.Http({ tracing: true }),
      new Sentry.Integrations.ContextLines(),
      new Sentry.Integrations.LinkedErrors(),
      new ExtraErrorData({
        depth: 2,
      }),
      new Dedupe(),
    ],
    maxBreadcrumbs: 5,
    defaultIntegrations: false,
    autoSessionTracking: false,
  });

  const server = await createServer({
    name: 'graphql-api',
    tracing: true,
  });

  registerShutdown({
    logger: server.log,
    async onShutdown() {
      await server.close();
    },
  });

  function createErrorHandler(level: Sentry.SeverityLevel): LogFn {
    return (error: any, errorLike?: any, ...args: any[]) => {
      server.log.error(error, errorLike, ...args);

      const errorObj = error instanceof Error ? error : errorLike instanceof Error ? errorLike : null;

      if (errorObj instanceof Error) {
        Sentry.captureException(errorObj, {
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

    // eslint-disable-next-line no-inner-declarations
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

    const graphqlLogger = createGraphQLLogger();

    const registry = createRegistry({
      tokens: {
        endpoint: ensureEnv('TOKENS_ENDPOINT'),
      },
      billing: {
        endpoint: process.env.BILLING_ENDPOINT ? ensureEnv('BILLING_ENDPOINT').replace(/\/$/g, '') : null,
      },
      webhooks: {
        endpoint: ensureEnv('WEBHOOKS_ENDPOINT').replace(/\/$/g, ''),
      },
      schemaService: {
        endpoint: ensureEnv('SCHEMA_ENDPOINT').replace(/\/$/g, ''),
      },
      usageEstimationService: {
        endpoint: process.env.USAGE_ESTIMATOR_ENDPOINT
          ? ensureEnv('USAGE_ESTIMATOR_ENDPOINT').replace(/\/$/g, '')
          : null,
      },
      rateLimitService: {
        endpoint: process.env.RATE_LIMIT_ENDPOINT ? ensureEnv('RATE_LIMIT_ENDPOINT').replace(/\/$/g, '') : null,
      },
      logger: graphqlLogger,
      storage: await createPostgreSQLStorage(createConnectionString(process.env as any)),
      redis: {
        host: ensureEnv('REDIS_HOST'),
        port: ensureEnv('REDIS_PORT', 'number'),
        password: ensureEnv('REDIS_PASSWORD'),
      },
      githubApp: {
        appId: ensureEnv('GITHUB_APP_ID', 'number'),
        privateKey: ensureEnv('GITHUB_APP_PRIVATE_KEY'),
      },
      clickHouse: {
        protocol: ensureEnv('CLICKHOUSE_PROTOCOL'),
        host: ensureEnv('CLICKHOUSE_HOST'),
        port: ensureEnv('CLICKHOUSE_PORT', 'number'),
        username: ensureEnv('CLICKHOUSE_USERNAME'),
        password: ensureEnv('CLICKHOUSE_PASSWORD'),
        onReadEnd(query, timings) {
          clickHouseReadDuration.labels({ query }).observe(timings.totalSeconds);
          clickHouseElapsedDuration.labels({ query }).observe(timings.elapsedSeconds);
        },
      },
      cdn: {
        authPrivateKey: ensureEnv('CDN_AUTH_PRIVATE_KEY'),
        baseUrl: ensureEnv('CDN_BASE_URL'),
        cloudflare: {
          basePath: ensureEnv('CF_BASE_PATH'),
          accountId: ensureEnv('CF_ACCOUNT_ID'),
          authToken: ensureEnv('CF_AUTH_TOKEN'),
          namespaceId: ensureEnv('CF_NAMESPACE_ID'),
        },
      },
      encryptionSecret: ensureEnv('ENCRYPTION_SECRET'),
      feedback: {
        token: ensureEnv('FEEDBACK_SLACK_TOKEN'),
        channel: ensureEnv('FEEDBACK_SLACK_CHANNEL'),
      },
      schemaConfig:
        typeof process.env.WEB_APP_URL === 'string'
          ? {
              schemaPublishLink(input) {
                let url = `${process.env.WEB_APP_URL}/${input.organization.cleanId}/${input.project.cleanId}/${input.target.cleanId}`;

                if (input.version) {
                  url += `/history/${input.version.id}`;
                }

                return url;
              },
            }
          : {},
    });
    const graphqlPath = '/graphql';
    const port = process.env.PORT || 4000;
    const signature = Math.random().toString(16).substr(2);
    const graphql = graphqlHandler({
      graphiqlEndpoint: graphqlPath,
      registry,
      signature,
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

    server.route({
      method: ['GET', 'HEAD'],
      url: '/_health',
      async handler(req, res) {
        res.status(200).send(); // eslint-disable-line @typescript-eslint/no-floating-promises -- false positive, FastifyReply.then returns void
      },
    });

    server.route({
      method: 'GET',
      url: '/lab/:org/:project/:target',
      async handler(req, res) {
        res.status(200).send({ ok: true }); // eslint-disable-line @typescript-eslint/no-floating-promises -- false positive, FastifyReply.then returns void
      },
    });

    server.route({
      method: ['GET', 'HEAD'],
      url: '/_readiness',
      async handler(req, res) {
        try {
          const response = await got.post(`http://0.0.0.0:${port}${graphqlPath}`, {
            method: 'POST',
            body: introspection,
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
              'x-signature': signature,
            },
          });

          if (response.statusCode >= 200 && response.statusCode < 300) {
            if (response.body.includes('"__schema"')) {
              reportReadiness(true);
              res.status(200).send(); // eslint-disable-line @typescript-eslint/no-floating-promises -- false positive, FastifyReply.then returns void
              return;
            }
          }
          console.error(response.statusCode, response.body);
        } catch (error) {
          console.error(error);
        }

        reportReadiness(false);
        res.status(500).send(); // eslint-disable-line @typescript-eslint/no-floating-promises -- false positive, FastifyReply.then returns void
      },
    });

    if (process.env.METRICS_ENABLED === 'true') {
      await startMetrics();
    }

    await server.listen(port, '0.0.0.0');
  } catch (error) {
    server.log.fatal(error);
    Sentry.captureException(error, {
      level: 'fatal',
    });
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
