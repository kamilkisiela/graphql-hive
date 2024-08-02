import {
  DocumentNode,
  GraphQLSchema,
  Kind,
  OperationDefinitionNode,
  TypeInfo,
  type ExecutionArgs,
} from 'graphql';
import LRU from 'tiny-lru';
import { normalizeOperation } from '../normalize/operation.js';
import { version } from '../version.js';
import { createAgent } from './agent.js';
import { collectSchemaCoordinates } from './collect-schema-coordinates.js';
import { dynamicSampling, randomSampling } from './sampling.js';
import type {
  AbortAction,
  ClientInfo,
  CollectUsageCallback,
  GraphQLErrorsResult,
  HivePluginOptions,
  HiveUsagePluginOptions,
} from './types.js';
import {
  cache,
  cacheDocumentKey,
  createHiveLogger,
  logIf,
  measureDuration,
  memo,
} from './utils.js';

interface UsageCollector {
  collect(): CollectUsageCallback;
  /** collect a short lived GraphQL request (mutation/query operation) */
  collectRequest(args: {
    args: ExecutionArgs;
    result: GraphQLErrorsResult | AbortAction;
    /** duration in milliseconds */
    duration: number;
    experimental__persistedDocumentHash?: string;
  }): void;
  /** collect a long-lived GraphQL request/subscription (subscription operation) */
  collectSubscription(args: {
    args: ExecutionArgs;
    experimental__persistedDocumentHash?: string;
  }): void;
  dispose(): Promise<void>;
}

function isAbortAction(result: Parameters<CollectUsageCallback>[1]): result is AbortAction {
  return 'action' in result && result.action === 'abort';
}

export function createUsage(pluginOptions: HivePluginOptions): UsageCollector {
  if (!pluginOptions.usage || pluginOptions.enabled === false) {
    return {
      collect() {
        return async () => {};
      },
      collectRequest() {},
      async dispose() {},
      collectSubscription() {},
    };
  }

  let reportSize = 0;
  let reportMap: Record<string, OperationMapRecord> = {};
  let reportOperations: RequestOperation[] = [];
  let reportSubscriptionOperations: SubscriptionOperation[] = [];

  const options =
    typeof pluginOptions.usage === 'boolean' ? ({} as HiveUsagePluginOptions) : pluginOptions.usage;
  const selfHostingOptions = pluginOptions.selfHosting;
  const logger = createHiveLogger(pluginOptions.agent?.logger ?? console, '[hive][usage]');
  const collector = memo(createCollector, arg => arg.schema);
  const excludeSet = new Set(options.exclude ?? []);

  const agent = createAgent<AgentAction>(
    {
      ...(pluginOptions.agent ?? {
        maxSize: 1500,
      }),
      logger,
      endpoint:
        selfHostingOptions?.usageEndpoint ??
        options.endpoint ??
        'https://app.graphql-hive.com/usage',
      token: pluginOptions.token,
      enabled: pluginOptions.enabled,
      debug: pluginOptions.debug,
      __testing: pluginOptions.agent?.__testing,
    },
    {
      data: {
        set(action) {
          if (action.type === 'request') {
            const operation = action.data;
            reportOperations.push({
              operationMapKey: operation.key,
              timestamp: operation.timestamp,
              execution: {
                ok: operation.execution.ok,
                duration: operation.execution.duration,
                errorsTotal: operation.execution.errorsTotal,
              },
              metadata: {
                client: operation.client ?? undefined,
              },
              persistedDocumentHash: operation.persistedDocumentHash,
            });
          } else if (action.type === 'subscription') {
            const operation = action.data;
            reportSubscriptionOperations.push({
              operationMapKey: operation.key,
              timestamp: operation.timestamp,
              metadata: {
                client: operation.client ?? undefined,
              },
              persistedDocumentHash: operation.persistedDocumentHash,
            });
          }

          reportSize += 1;

          if (!reportMap[action.data.key]) {
            reportMap[action.data.key] = {
              operation: action.data.operation,
              operationName: action.data.operationName,
              fields: action.data.fields,
            };
          }
        },
        size() {
          return reportSize;
        },
        clear() {
          reportSize = 0;
          reportMap = {};
          reportOperations = [];
          reportSubscriptionOperations = [];
        },
      },
      headers() {
        return {
          'graphql-client-name': 'Hive Client',
          'graphql-client-version': version,
          'x-usage-api-version': '2',
        };
      },
      body() {
        const report: Report = {
          size: reportSize,
          map: reportMap,
          operations: reportOperations.length ? reportOperations : undefined,
          subscriptionOperations: reportSubscriptionOperations.length
            ? reportSubscriptionOperations
            : undefined,
        };
        return JSON.stringify(report);
      },
    },
  );

  logIf(
    typeof pluginOptions.token !== 'string' || pluginOptions.token.length === 0,
    'token is missing',
    logger.error,
  );

  const shouldInclude =
    options.sampler && typeof options.sampler === 'function'
      ? dynamicSampling(options.sampler)
      : randomSampling(options.sampleRate ?? 1.0);

  const collectRequest: UsageCollector['collectRequest'] = args => {
    let providedOperationName: string | undefined = undefined;
    try {
      if (isAbortAction(args.result)) {
        if (args.result.logging) {
          logger.info(args.result.reason);
        }
        return;
      }

      const document = args.args.document;
      const rootOperation = document.definitions.find(
        o => o.kind === Kind.OPERATION_DEFINITION,
      ) as OperationDefinitionNode;
      providedOperationName = args.args.operationName || rootOperation.name?.value;
      const operationName = providedOperationName || 'anonymous';
      // Check if operationName is a match with any string or regex in excludeSet
      const isMatch = Array.from(excludeSet).some(excludingValue =>
        excludingValue instanceof RegExp
          ? excludingValue.test(operationName)
          : operationName === excludingValue,
      );
      if (
        !isMatch &&
        shouldInclude({
          operationName,
          document,
          variableValues: args.args.variableValues,
          contextValue: args.args.contextValue,
        })
      ) {
        const errors =
          args.result.errors?.map(error => ({
            message: error.message,
            path: error.path?.join('.'),
          })) ?? [];
        const collect = collector({
          schema: args.args.schema,
          max: options.max ?? 1000,
          ttl: options.ttl,
          processVariables: options.processVariables ?? false,
        });

        agent.capture(
          collect(document, args.args.variableValues ?? null).then(({ key, value: info }) => {
            return {
              type: 'request',
              data: {
                key,
                timestamp: Date.now(),
                operationName,
                operation: info.document,
                fields: info.fields,
                execution: {
                  ok: errors.length === 0,
                  duration: args.duration,
                  errorsTotal: errors.length,
                  errors,
                },
                // TODO: operationHash is ready to accept hashes of persisted operations
                client: args.experimental__persistedDocumentHash
                  ? undefined
                  : pickClientInfoProperties(
                      typeof args.args.contextValue !== 'undefined' &&
                        typeof options.clientInfo !== 'undefined'
                        ? options.clientInfo(args.args.contextValue)
                        : createDefaultClientInfo()(args.args.contextValue),
                    ),
                persistedDocumentHash: args.experimental__persistedDocumentHash,
              },
            };
          }),
        );
      }
    } catch (error) {
      const details = providedOperationName ? ` (name: "${providedOperationName}")` : '';
      logger.error(`Failed to collect operation${details}`, error);
    }
  };

  return {
    dispose: agent.dispose,
    collectRequest,
    collect() {
      const finish = measureDuration();

      return async function complete(args, result, experimental__persistedDocumentHash) {
        const duration = finish();
        return collectRequest({ args, result, duration, experimental__persistedDocumentHash });
      };
    },
    async collectSubscription({ args, experimental__persistedDocumentHash }) {
      const document = args.document;
      const rootOperation = document.definitions.find(
        o => o.kind === Kind.OPERATION_DEFINITION,
      ) as OperationDefinitionNode;
      const providedOperationName = args.operationName || rootOperation.name?.value;
      const operationName = providedOperationName || 'anonymous';
      // Check if operationName is a match with any string or regex in excludeSet
      const isMatch = Array.from(excludeSet).some(excludingValue =>
        excludingValue instanceof RegExp
          ? excludingValue.test(operationName)
          : operationName === excludingValue,
      );
      if (
        !isMatch &&
        shouldInclude({
          operationName,
          document,
          variableValues: args.variableValues,
          contextValue: args.contextValue,
        })
      ) {
        const collect = collector({
          schema: args.schema,
          max: options.max ?? 1000,
          ttl: options.ttl,
          processVariables: options.processVariables ?? false,
        });

        agent.capture(
          collect(document, args.variableValues ?? null).then(({ key, value: info }) => ({
            type: 'subscription',
            data: {
              key,
              timestamp: Date.now(),
              operationName,
              operation: info.document,
              fields: info.fields,
              // when there is a persisted document hash, we don't need to send the client info,
              // as it's already included in the persisted document hash and usage ingestor will extract that info
              client: experimental__persistedDocumentHash
                ? undefined
                : typeof args.contextValue !== 'undefined' &&
                    typeof options.clientInfo !== 'undefined'
                  ? options.clientInfo(args.contextValue)
                  : createDefaultClientInfo()(args.contextValue),
              persistedDocumentHash: experimental__persistedDocumentHash,
            },
          })),
        );
      }
    },
  };
}

interface CacheResult {
  document: string;
  fields: string[];
}

export function createCollector({
  schema,
  max,
  ttl,
  processVariables = false,
}: {
  schema: GraphQLSchema;
  max?: number;
  ttl?: number;
  processVariables?: boolean;
}) {
  const typeInfo = new TypeInfo(schema);

  function collect(
    doc: DocumentNode,
    variables: {
      [key: string]: unknown;
    } | null,
  ): CacheResult {
    const entries = collectSchemaCoordinates({
      documentNode: doc,
      processVariables,
      schema,
      typeInfo,
      variables,
    });

    return {
      document: normalizeOperation({
        document: doc,
        hideLiterals: true,
        removeAliases: true,
      }),
      fields: Array.from(entries),
    };
  }

  return cache(
    collect,
    function cacheKey(doc, variables) {
      return cacheDocumentKey(doc, processVariables === true ? variables : null);
    },
    LRU<CacheResult>(max, ttl),
  );
}

export interface Report {
  size: number;
  map: OperationMap;
  operations?: RequestOperation[];
  subscriptionOperations?: SubscriptionOperation[];
}

type AgentAction =
  | {
      type: 'request';
      data: CollectedOperation;
    }
  | {
      type: 'subscription';
      data: CollectedSubscriptionOperation;
    };

interface CollectedOperation {
  key: string;
  timestamp: number;
  operation: string;
  operationName?: string | null;
  fields: string[];
  execution: {
    ok: boolean;
    duration: number;
    errorsTotal: number;
    errors?: Array<{
      message: string;
      path?: string;
    }>;
  };
  persistedDocumentHash?: string;
  client?: ClientInfo | null;
}

interface CollectedSubscriptionOperation {
  key: string;
  timestamp: number;
  operation: string;
  operationName?: string | null;
  fields: string[];
  persistedDocumentHash?: string;
  client?: ClientInfo | null;
}

interface RequestOperation {
  operationMapKey: string;
  timestamp: number;
  execution: {
    ok: boolean;
    duration: number;
    errorsTotal: number;
  };
  persistedDocumentHash?: string;
  metadata?: {
    client?: {
      name: string;
      version: string;
    };
  };
}

interface SubscriptionOperation {
  operationMapKey: string;
  timestamp: number;
  persistedDocumentHash?: string;
  metadata?: {
    client?: {
      name: string;
      version: string;
    };
  };
}

interface OperationMapRecord {
  operation: string;
  operationName?: string | null;
  fields: string[];
}

interface OperationMap {
  [key: string]: OperationMapRecord;
}

const defaultClientNameHeader = 'x-graphql-client-name';
const defaultClientVersionHeader = 'x-graphql-client-version';

type CreateDefaultClientInfo = {
  /** HTTP configuration */
  http?: {
    clientHeaderName: string;
    versionHeaderName: string;
  };
  /** GraphQL over Websocket configuration */
  ws?: {
    /** The name of the field within `context.connectionParams`, that contains the client info object. */
    clientFieldName: string;
  };
};

function createDefaultClientInfo(
  config?: CreateDefaultClientInfo,
): (context: unknown) => ClientInfo | null {
  const clientNameHeader = config?.http?.clientHeaderName ?? defaultClientNameHeader;
  const clientVersionHeader = config?.http?.versionHeaderName ?? defaultClientVersionHeader;
  const clientFieldName = config?.ws?.clientFieldName ?? 'client';
  return function defaultClientInfo(context: any) {
    // whatwg Request
    if (typeof context?.request?.headers?.get === 'function') {
      const name = context.request.headers.get(clientNameHeader);
      const version = context.request.headers.get(clientVersionHeader);
      if (typeof name === 'string' && typeof version === 'string') {
        return {
          name,
          version,
        };
      }

      return null;
    }

    // Node.js IncomingMessage
    if (context?.req?.headers && typeof context.req?.headers === 'object') {
      const name = context.req.headers[clientNameHeader];
      const version = context.req.headers[clientVersionHeader];
      if (typeof name === 'string' && typeof version === 'string') {
        return {
          name,
          version,
        };
      }

      return null;
    }

    // Plain headers object
    if (context?.headers && typeof context.req?.headers === 'object') {
      const name = context.req.headers[clientNameHeader];
      const version = context.req.headers[clientVersionHeader];
      if (typeof name === 'string' && typeof version === 'string') {
        return {
          name,
          version,
        };
      }

      return null;
    }

    // GraphQL over WebSocket
    if (
      context?.connectionParams?.[clientFieldName] &&
      typeof context.connectionParams?.[clientFieldName] === 'object'
    ) {
      const name = context.connectionParams[clientFieldName].name;
      const version = context.connectionParams[clientFieldName].version;

      if (typeof name === 'string' && typeof version === 'string') {
        return {
          name,
          version,
        };
      }

      return null;
    }

    return null;
  };
}

function pickClientInfoProperties(info: null | undefined | ClientInfo): null | ClientInfo {
  if (!info) {
    return null;
  }
  return {
    name: info.name,
    version: info.version,
  };
}
