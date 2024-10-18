import {
  type execute as ExecuteImplementation,
  type ExecutionResult,
  type GraphQLSchema,
  type subscribe as SubscribeImplementation,
} from 'graphql';
import { version } from '../version.js';
import { http } from './http-client.js';
import { createPersistedDocuments } from './persisted-documents.js';
import { createReporting } from './reporting.js';
import type { HiveClient, HivePluginOptions } from './types.js';
import { createUsage } from './usage.js';
import { createHiveLogger, logIf } from './utils.js';

export function createHive(options: HivePluginOptions): HiveClient {
  const logger = createHiveLogger(options?.agent?.logger ?? console, '[hive]');
  let enabled = options.enabled ?? true;

  if (enabled === false) {
    logIf(options.debug === true, 'plugin is not enabled.', logger.info);
  }

  if (!options.token && enabled) {
    enabled = false;
    logger.info('Missing token, disabling.');
  }

  const mergedOptions: HivePluginOptions = { ...options, enabled } as HivePluginOptions;

  const usage = createUsage(mergedOptions);
  const schemaReporter = createReporting(mergedOptions);

  function reportSchema({ schema }: { schema: GraphQLSchema }) {
    schemaReporter.report({ schema });
  }

  function collectUsage() {
    return usage.collect();
  }

  function collectRequest(...args: Parameters<typeof usage.collectRequest>) {
    return usage.collectRequest(...args);
  }

  async function dispose() {
    await Promise.all([schemaReporter.dispose(), usage.dispose()]);
  }

  // enabledOnly when `printTokenInfo` is `true` or `debug` is true and `printTokenInfo` is not `false`
  const printTokenInfo = enabled
    ? options.printTokenInfo === true || (!!options.debug && options.printTokenInfo !== false)
    : false;
  const infoLogger = createHiveLogger(logger, '[info]');

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

          infoLogger.info('Fetching token details...');

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
                'user-agent': `hive-client/${version}`,
                'graphql-client-name': 'Hive Client',
                'graphql-client-version': version,
              },
              timeout: 30_000,
              fetchImplementation: options?.agent?.__testing?.fetch,
              logger: infoLogger,
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

              infoLogger.info(
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
              infoLogger.error(`Token not found. Reason: ${result.data?.tokenInfo.message}`);
              infoLogger.info(
                `How to create a token? https://docs.graphql-hive.com/features/tokens`,
              );
            } else {
              infoLogger.error(`${result.errors![0].message}`);
              infoLogger.info(
                `How to create a token? https://docs.graphql-hive.com/features/tokens`,
              );
            }
          } else {
            infoLogger.error(`Error ${response.status}: ${response.statusText}`);
          }
        } catch (error) {
          infoLogger.error(`Error ${(error as Error)?.message ?? error}`);
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
        void result.then(result => collect(args, result));
      } else {
        void collect(args, result);
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
    experimental__persistedDocuments: options.experimental__persistedDocuments
      ? createPersistedDocuments({
          ...options.experimental__persistedDocuments,
          logger,
        })
      : null,
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
