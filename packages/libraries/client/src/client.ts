import { GraphQLSchema, ExecutionArgs, ExecutionResult } from 'graphql';
import axios from 'axios';
import type { HivePluginOptions, HiveClient } from './internal/types';
import { createUsage } from './internal/usage';
import { createReporting } from './internal/reporting';
import { createOperationsStore } from './internal/operations-store';

export function createHive(options: HivePluginOptions): HiveClient {
  const logger = options?.agent?.logger ?? console;

  if (!options.token && options.enabled) {
    options.enabled = false;
    logger.info('[hive] Missing token, disabling.');
  }

  const usage = createUsage(options);
  const schemaReporter = createReporting(options);
  const operationsStore = createOperationsStore(options);

  function reportSchema({ schema }: { schema: GraphQLSchema }) {
    schemaReporter.report({ schema });
  }

  function collectUsage(args: ExecutionArgs) {
    return usage.collect(args);
  }

  async function dispose() {
    await Promise.all([schemaReporter.dispose(), usage.dispose()]);
  }

  async function info() {
    if (options.enabled !== true) {
      return;
    }

    try {
      let endpoint = 'https://app.graphql-hive.com/registry';

      if (options.reporting && options.reporting.endpoint) {
        endpoint = options.reporting.endpoint;
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
            'x-api-token': options.token,
          },
          timeout: 30_000,
          decompress: true,
          responseType: 'json',
        }
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

          const organizationUrl = `https://app.graphql-hive.com/${organization.cleanId}`;
          const projectUrl = `${organizationUrl}/${project.cleanId}`;
          const targetUrl = `${projectUrl}/${target.cleanId}`;

          logger.info(
            [
              '[hive][info] Token details',
              '',
              `Token name:            ${print(tokenInfo.token.name)}`,
              `Organization:          ${print(
                organization.name,
                organizationUrl
              )}`,
              `Project:               ${print(project.name, projectUrl)}`,
              `Target:                ${print(target.name, targetUrl)}`,
              '',
              `Can report schema?     ${print(canReportSchema ? 'Yes' : 'No')}`,
              `Can collect usage?     ${print(canCollectUsage ? 'Yes' : 'No')}`,
              `Can read operations?   ${print(
                canReadOperations ? 'Yes' : 'No'
              )}`,
              '',
            ].join('\n')
          );
        } else if (result.data?.tokenInfo.message) {
          logger.error(
            `[hive][info] Token not found. Reason: ${result.data?.tokenInfo.message}`
          );
          logger.info(
            `[hive][info] How to create a token? https://docs.graphql-hive.com/features/tokens`
          );
        } else {
          logger.error(`[hive][info] ${result.errors![0].message}`);
          logger.info(
            `[hive][info] How to create a token? https://docs.graphql-hive.com/features/tokens`
          );
        }
      } else {
        logger.error(
          `[hive][info] Error ${response.status}: ${response.statusText}`
        );
      }
    } catch (error: any) {
      logger.error(`[hive][info] Error ${error.message}`);
    }
  }

  return {
    info,
    reportSchema,
    collectUsage,
    operationsStore,
    dispose,
  };
}

function createPrinter(values: string[]) {
  const maxLen = Math.max(...values.map((v) => v.length)) + 4;

  return (base: string, extra?: string) => {
    return base.padEnd(maxLen, ' ') + (extra || '');
  };
}
