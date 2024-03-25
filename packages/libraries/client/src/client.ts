import axios from 'axios';
import {
  type execute as ExecuteImplementation,
  type ExecutionResult,
  type GraphQLSchema,
  type subscribe as SubscribeImplementation,
} from 'graphql';
import { createReporting } from './internal/reporting.js';
import type { HiveClient, HivePluginOptions } from './internal/types.js';
import { createUsage } from './internal/usage.js';
import { logIf } from './internal/utils.js';
import { version } from './version.js';

export function createHive(options: HivePluginOptions): HiveClient {
  const logger = options?.agent?.logger ?? console;
  let enabled = options.enabled ?? true;

  if (enabled === false) {
    logIf(options.debug === true, '[hive] is not enabled.', logger.info);
  }

  if (!options.token && enabled) {
    enabled = false;
    logger.info('[hive] Missing token, disabling.');
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

  async function dispose() {
    await Promise.all([schemaReporter.dispose(), usage.dispose()]);
  }

  async function info(): Promise<void> {
    if (enabled === false) {
      return;
    }

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
                name
                cleanId
              }
              project {
                name
                type
                cleanId
              }
              target {
                name
                cleanId
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

      const response = await axios.post(
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
          decompress: true,
          responseType: 'json',
        },
      );

      if (response.status >= 200 && response.status < 300) {
        const result: ExecutionResult<any> = await response.data;

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
          const organizationUrl = `${appUrl}/${organization.cleanId}`;
          const projectUrl = `${organizationUrl}/${project.cleanId}`;
          const targetUrl = `${projectUrl}/${target.cleanId}`;

          logger.info(
            [
              '[hive][info] Token details',
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
          logger.error(`[hive][info] Token not found. Reason: ${result.data?.tokenInfo.message}`);
          logger.info(
            `[hive][info] How to create a token? https://docs.graphql-hive.com/features/tokens`,
          );
        } else {
          logger.error(`[hive][info] ${result.errors![0].message}`);
          logger.info(
            `[hive][info] How to create a token? https://docs.graphql-hive.com/features/tokens`,
          );
        }
      } else {
        logger.error(`[hive][info] Error ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      logger.error(`[hive][info] Error ${(error as Error)?.message ?? error}`);
    }
  }

  function createInstrumentedExecute(
    executeImpl: typeof ExecuteImplementation,
  ): typeof ExecuteImplementation {
    return function hiveInstrumentedExecute(args) {
      const collect = usage.collect();
      const result = executeImpl(args);
      if ('then' in result) {
        void result.then(result => collect(args, result));
      } else {
        collect(args, result);
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
    dispose,
    collectSubscriptionUsage: usage.collectSubscription,
    createInstrumentedSubscribe,
    createInstrumentedExecute,
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
