import {
  type execute as ExecuteImplementation,
  type ExecutionResult,
  type GraphQLSchema,
  type subscribe as SubscribeImplementation,
} from 'graphql';
import { Logger } from '@graphql-hive/logger';
import { version } from '../version.js';
import { http } from './http-client.js';
import { createPersistedDocuments } from './persisted-documents.js';
import { createReporting } from './reporting.js';
import type { HiveClient, HiveInternalPluginOptions, HivePluginOptions } from './types.js';
import { createUsage } from './usage.js';
import { chooseLogger, isLegacyAccessToken } from './utils.js';

function resolveLoggerFromConfigOptions(options: HivePluginOptions): Logger {
  if (typeof options.logger == 'string') {
    return new Logger({
      level: options.logger,
    });
  }

  if (options.logger instanceof Logger) {
    return options.logger;
  }

  return chooseLogger(options.logger ?? options.agent?.logger, options.debug);
}

export function createHive(options: HivePluginOptions): HiveClient {
  const logger = resolveLoggerFromConfigOptions(options).child({ module: 'hive' });
  let enabled = options.enabled ?? true;

  if (enabled === false && !options.persistedDocuments) {
    logger.debug('Plugin is not enabled.');
  }

  if (!options.token && enabled) {
    enabled = false;
    logger.info('Missing token, disabling.');
  }

  const mergedOptions: HiveInternalPluginOptions = {
    ...options,
    enabled,
    logger,
  } as HiveInternalPluginOptions;

  const usage = createUsage(mergedOptions);
  const schemaReporter = createReporting(mergedOptions);
  const persistedDocuments = options.persistedDocuments
    ? createPersistedDocuments({
        ...options.persistedDocuments,
        logger,
        fetch: options.persistedDocuments.fetch,
      })
    : null;

  function reportSchema({ schema }: { schema: GraphQLSchema }) {
    schemaReporter.report({ schema });
  }

  function collectUsage(...args: Parameters<typeof usage.collect>) {
    return usage.collect(...args);
  }

  function collectRequest(...args: Parameters<typeof usage.collectRequest>) {
    return usage.collectRequest(...args);
  }

  async function dispose() {
    await Promise.all([schemaReporter.dispose(), usage.dispose(), persistedDocuments?.dispose()]);
  }

  const isOrganizationAccessToken = !isLegacyAccessToken(options.token ?? '');

  // enabledOnly when `printTokenInfo` is `true` or `debug` is true and `printTokenInfo` is not `false`
  const printTokenInfo =
    enabled &&
    /** Access tokens using the `hvo1/` prefix cannot print any token information. */
    isOrganizationAccessToken === false
      ? options.printTokenInfo === true || (!!options.debug && options.printTokenInfo !== false)
      : false;

  const info = printTokenInfo
    ? async () => {
        try {
          let endpoint = 'https://app.graphql-hive.com/graphql';

          // Look for the reporting.endpoint for the legacy reason.
          if (options.reporting && options.reporting.endpoint) {
            endpoint = options.reporting.endpoint;
          }

          if (options.selfHosting?.graphqlEndpoint) {
            endpoint = options.selfHosting.graphqlEndpoint;
          }

          const query = /* GraphQL */ `
            query myTokenInfo {
              tokenInfo {
                __typename
                ... on TokenInfo {
                  token {
                    name
                  }
                  organization {
                    slug
                  }
                  project {
                    type
                    slug
                  }
                  target {
                    slug
                  }
                  canReportSchema: hasTargetScope(scope: REGISTRY_WRITE)
                  canCollectUsage: hasTargetScope(scope: REGISTRY_WRITE)
                  canReadOperations: hasProjectScope(scope: OPERATIONS_STORE_READ)
                }
                ... on TokenNotFoundError {
                  message
                }
              }
            }
          `;

          logger.info('Fetching token details...');

          const clientVersionForDetails = options.agent?.version || version;
          const response = await http.post(
            endpoint,
            JSON.stringify({
              query,
              operationName: 'myTokenInfo',
            }),
            {
              headers: {
                'content-type': 'application/json',
                Authorization: `Bearer ${options.token}`,
                'user-agent': `${options.agent?.name || 'hive-client'}/${clientVersionForDetails}`,
                'graphql-client-name': `${options.agent?.name || 'Hive Client'}`,
                'graphql-client-version': clientVersionForDetails,
              },
              timeout: 30_000,
              fetchImplementation: options?.agent?.fetch,
              logger,
            },
          );

          if (response.ok) {
            const result: ExecutionResult<any> = await response.json();

            if (result.data?.tokenInfo.__typename === 'TokenInfo') {
              const { tokenInfo } = result.data;

              const {
                organization,
                project,
                target,
                canReportSchema,
                canCollectUsage,
                canReadOperations,
              } = tokenInfo;
              const print = createPrinter([
                tokenInfo.token.name,
                organization.name,
                project.name,
                target.name,
              ]);

              const appUrl =
                options.selfHosting?.applicationUrl?.replace(/\/$/, '') ??
                'https://app.graphql-hive.com';
              const organizationUrl = `${appUrl}/${organization.slug}`;
              const projectUrl = `${organizationUrl}/${project.slug}`;
              const targetUrl = `${projectUrl}/${target.slug}`;

              logger.info(
                [
                  'Token details',
                  '',
                  `Token name:            ${print(tokenInfo.token.name)}`,
                  `Organization:          ${print(organization.name, organizationUrl)}`,
                  `Project:               ${print(project.name, projectUrl)}`,
                  `Target:                ${print(target.name, targetUrl)}`,
                  '',
                  `Can report schema?     ${print(canReportSchema ? 'Yes' : 'No')}`,
                  `Can collect usage?     ${print(canCollectUsage ? 'Yes' : 'No')}`,
                  `Can read operations?   ${print(canReadOperations ? 'Yes' : 'No')}`,
                  '',
                ].join('\n'),
              );
            } else if (result.data?.tokenInfo.message) {
              logger.error(`Token not found. Reason: ${result.data?.tokenInfo.message}`);
              logger.info(`How to create a token? https://docs.graphql-hive.com/features/tokens`);
            } else {
              logger.error(`${result.errors![0].message}`);
              logger.info(`How to create a token? https://docs.graphql-hive.com/features/tokens`);
            }
          } else {
            logger.error(`Error ${response.status}: ${response.statusText}`);
          }
        } catch (error) {
          logger.error(`Error ${(error as Error)?.message ?? error}`);
        }
      }
    : () => {};

  function createInstrumentedExecute(
    executeImpl: typeof ExecuteImplementation,
  ): typeof ExecuteImplementation {
    return function hiveInstrumentedExecute(args) {
      const collect = usage.collect();
      const result = executeImpl(args);
      if ('then' in result) {
        void result.then(result => collect.finish(args, result));
      } else {
        void collect.finish(args, result);
      }

      return result;
    };
  }

  function createInstrumentedSubscribe(
    subscribeImpl: typeof SubscribeImplementation,
  ): typeof SubscribeImplementation {
    return function hiveInstrumentedSubscribe(args) {
      usage.collectSubscription({ args });
      return subscribeImpl(args);
    };
  }

  return {
    [hiveClientSymbol]: true,
    [autoDisposeSymbol]: options.autoDispose ?? true,
    info,
    reportSchema,
    collectUsage,
    collectRequest,
    dispose,
    collectSubscriptionUsage: usage.collectSubscription,
    createInstrumentedSubscribe,
    createInstrumentedExecute,
    persistedDocuments,
  };
}

export const hiveClientSymbol: unique symbol = Symbol('hive-client');
export const autoDisposeSymbol: unique symbol = Symbol('hive-auto-dispose');

function createPrinter(values: string[]) {
  const maxLen = Math.max(...values.map(v => v.length)) + 4;

  return (base: string, extra?: string) => {
    return base.padEnd(maxLen, ' ') + (extra || '');
  };
}
