import {
  DocumentNode,
  GraphQLError,
  GraphQLSchema,
  Kind,
  OperationDefinitionNode,
  OperationTypeNode,
  TypeInfo,
  type ExecutionArgs,
} from 'graphql';
import { lru } from 'tiny-lru';
import { normalizeOperation } from '../normalize/operation.js';
import { version } from '../version.js';
import { getDefinedRootType } from './add-hive-typenames.js';
import { createAgent } from './agent.js';
import { collectSchemaCoordinates } from './collect-schema-coordinates.js';
import { dynamicSampling, randomSampling } from './sampling.js';
import { errorPathToCoordinate } from './subrequests/error-path-to-coordinate.js';
import { extractCoordinates } from './subrequests/extract-coordinates.js';
import type {
  AbortAction,
  ClientInfo,
  CollectUsage,
  CollectUsageCallback,
  CollectUsageOptions,
  GraphQLResult,
  GraphVersionInfo,
  HiveInternalPluginOptions,
  HiveUsagePluginOptions,
  TrackedGraphQLError,
} from './types.js';
import {
  cache,
  cacheDocumentKey,
  isLegacyAccessToken,
  logIf,
  measureDuration,
  memo,
  toTrackedError,
} from './utils.js';

interface UsageCollector {
  collect(options?: CollectUsageOptions): CollectUsage;
  /** collect a short lived GraphQL request (mutation/query operation) */
  collectRequest(args: {
    args: ExecutionArgs;
    result: GraphQLResult | AbortAction;
    /** duration in milliseconds */
    duration: number;
    experimental__persistedDocumentHash?: string;
    /** Optionally send subgraph request information. This provides a deeper level of usage metrics */
    fetches?: CollectedOperationSubRequest[] | null;
    gatewayErrors?: TrackedGraphQLError[] | null;
    /** The graph the operation was executed against. */
    graph?: GraphVersionInfo | null;
  }): void;
  /** collect a long-lived GraphQL request/subscription (subscription operation) */
  collectSubscription(args: {
    args: ExecutionArgs;
    experimental__persistedDocumentHash?: string;
    /** The graph the operation was executed against. */
    graph?: GraphVersionInfo | null;
  }): void;
  dispose(): Promise<void>;
}

function isAbortAction(result: Parameters<CollectUsageCallback>[1]): result is AbortAction {
  return 'action' in result && result.action === 'abort';
}

const noopUsageCollector: UsageCollector = {
  collect() {
    return {
      trackGatewayErrors() {},
      subrequest() {
        return () => {};
      },
      async finish() {},
    };
  },
  collectRequest() {},
  async dispose() {},
  collectSubscription() {},
};

export function createUsage(pluginOptions: HiveInternalPluginOptions): UsageCollector {
  if (!pluginOptions.usage || pluginOptions.enabled === false) {
    return noopUsageCollector;
  }

  let reportSize = 0;
  let reportMap: Record<string, OperationMapRecord> = {};
  let reportOperations: RequestOperation[] = [];
  let reportSubscriptionOperations: SubscriptionOperation[] = [];

  const options =
    typeof pluginOptions.usage === 'boolean' ? ({} as HiveUsagePluginOptions) : pluginOptions.usage;
  const selfHostingOptions = pluginOptions.selfHosting;
  const logger = pluginOptions.logger.child({ module: 'hive-usage' });
  const collector = memo(createCollector, arg => arg.schema);
  const exclusions = options.exclude ?? [];

  /** Access tokens using the `hvo1/` require a target. */
  if (!options.target && !isLegacyAccessToken(pluginOptions.token)) {
    logger.error(
      "Your access token requires providing the 'target' option." +
        '\nUsage reporting is disabled.',
    );
    return noopUsageCollector;
  }

  if (options.target && isLegacyAccessToken(pluginOptions.token)) {
    logger.error(
      "Using the 'target' option requires using an organization access token (starting with 'hvo1/')." +
        '\nUsage reporting is disabled.',
    );
    return noopUsageCollector;
  }

  const baseEndpoint =
    selfHostingOptions?.usageEndpoint ?? options.endpoint ?? 'https://app.graphql-hive.com/usage';

  const endpoint = baseEndpoint + (options?.target ? `/${options.target}` : '');

  const agent = createAgent<AgentAction>(
    {
      ...(pluginOptions.agent ?? {
        maxSize: 1500,
      }),
      logger,
      endpoint,
      token: pluginOptions.token,
      enabled: pluginOptions.enabled,
      debug: pluginOptions.debug,
      fetch: pluginOptions.agent?.fetch,
    },
    {
      data: {
        set(action) {
          if (action.type === 'request') {
            const operation = action.data;
            const fetches = operation.execution.fetches?.map((f): OperationSubRequest => {
              const subgraphFields = extractCoordinates({
                schema: f.subgraphSchema,
                document: f.document,
                resultData: f.result?.data,
              });
              const errors: { coordinate: string; code?: string }[] = [];
              for (const error of f.result?.errors ?? []) {
                const coordinate =
                  error.path &&
                  errorPathToCoordinate(f.subgraphSchema, error.path, f.document, f.result?.data);
                if (coordinate) {
                  errors.push({
                    coordinate,
                    code: error.extensions?.code as string | undefined,
                  });
                }
              }

              return {
                duration: f.duration,
                start: f.start,
                status: f.status,
                type: f.type,
                paths: f.paths ?? 'Query',
                subgraph: f.subgraph,
                errors,
                fields: subgraphFields,
              };
            });
            reportOperations.push({
              operationMapKey: operation.key,
              timestamp: operation.timestamp,
              execution: {
                ok: operation.execution.ok,
                duration: operation.execution.duration,
                errorsTotal: operation.execution.errorsTotal,
                fetches,
                gatewayErrors: operation.execution.gatewayErrors,
              },
              metadata: {
                client: operation.client ?? undefined,
                graph: operation.graph,
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
                graph: operation.graph,
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
          'graphql-client-name': pluginOptions.agent?.name ?? 'Hive Client',
          'graphql-client-version': pluginOptions.agent?.version ?? version,
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
      const result = args.result;
      if (isAbortAction(result)) {
        if (result.logging) {
          logger.info(result.reason);
        }
        return;
      }

      const document = args.args.document;
      const rootOperation = document.definitions.find(
        o => o.kind === Kind.OPERATION_DEFINITION,
      ) as OperationDefinitionNode;
      providedOperationName = args.args.operationName || rootOperation.name?.value;
      const operationName = providedOperationName || 'anonymous';
      // Check if operationName is a match with any string or regex in exclusions
      const isMatch = exclusions.some(excludingValue =>
        excludingValue instanceof RegExp
          ? excludingValue.test(operationName)
          : operationName === excludingValue,
      );
      let gatewayErrors = args.gatewayErrors;
      if (
        !isMatch &&
        shouldInclude({
          operationName,
          document,
          variableValues: args.args.variableValues,
          contextValue: args.args.contextValue,
        })
      ) {
        const collect = collector({
          schema: args.args.schema,
          max: options.max ?? 1000,
          ttl: options.ttl,
          processVariables: options.processVariables ?? false,
        });

        let fetches = args.fetches;
        let errorsTotal = 0;
        if (options.fieldLevelMetricsEnabled) {
          if (!fetches?.length) {
            /**
             * No subgraph requests, so this must be a monolith.
             * We still want to track the field metrics, so create an artificial
             * fetch that represents the local lookup.
             */
            const rootPath =
              getDefinedRootType(
                args.args.schema,
                rootOperation.operation ?? OperationTypeNode.QUERY,
              )?.name ?? 'Query';

            fetches = [
              {
                document: args.args.document,
                duration: args.duration,
                start: 0,
                subgraph: '',
                subgraphSchema: args.args.schema,
                type: 'ROOT',
                paths: rootPath,
                result: { data: result.data }, // errors are captured by gateway errors in this instance
              },
            ];
            // Use the result errors in this case since it will be for the entire payload and there are no fetch errors.
            // Use the gatewayErrors as a fallback since those should also be tracked.
            gatewayErrors =
              result.errors
                ?.map(e => toTrackedError(e, args.args.schema, args.args.document, result.data))
                .filter(e => !!e) ?? args.gatewayErrors;
            errorsTotal = result.errors?.length ?? 0;
          } else {
            for (const subRequest of fetches) {
              errorsTotal += subRequest.result?.errors?.length ?? 0;
            }
            if (args.gatewayErrors) {
              errorsTotal += args.gatewayErrors?.length ?? 0;
            }
          }
        } else {
          errorsTotal = result.errors?.length ?? 0;
        }

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
                  ok: !result.errors?.length,
                  duration: args.duration,
                  errorsTotal,
                  fetches,
                  gatewayErrors,
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
                graph: toGraphMetadata(args.graph),
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

  /**
   * The usage API requires both graphId and graphVersionId to be valid UUIDs and rejects the whole report otherwise.
   * Omit the graph metadata instead of losing the whole batch.
   */
  function toGraphMetadata(
    graph: GraphVersionInfo | null | undefined,
  ): GraphVersionInfo | undefined {
    if (graph == null) {
      return undefined;
    }
    const { graphId, graphVersionId } = graph;
    if (uuidRegex.test(graphId) && uuidRegex.test(graphVersionId)) {
      return { graphId, graphVersionId };
    }
    logger.debug(
      `Ignoring graph metadata (graphId="${graphId}", graphVersionId="${graphVersionId}"). Both must be UUIDs.`,
    );
    return undefined;
  }

  return {
    dispose: agent.dispose,
    /** The raw request collection function */
    collectRequest,
    /**
     * A more advanced method of collecting the request that includes calculating durations
     * automatically and supports subrequest data.
     */
    collect(collectOptions) {
      const sinceStart = measureDuration();
      const subRequests: CollectedOperationSubRequest[] = [];
      let gatewayErrors: any[] | Error[] | GraphQLError[][] | undefined = undefined;
      return {
        trackGatewayErrors({ errors }) {
          if (errors) {
            gatewayErrors ??= [];
            gatewayErrors.push(...errors);
          }
        },
        subrequest({ subgraph, type, paths }) {
          const start = sinceStart();
          const sinceSubStart = measureDuration();
          return args => {
            const duration = sinceSubStart();
            subRequests.push({
              start,
              duration,
              status: args.status,
              subgraph,
              type,
              result: args.result,
              document: args.document,
              subgraphSchema: args.subgraphSchema,
              paths,
            });
          };
        },
        async finish(args, result, experimental__persistedDocumentHash) {
          const duration = sinceStart();
          return collectRequest({
            args,
            result,
            duration,
            experimental__persistedDocumentHash,
            fetches: subRequests.length > 0 ? subRequests : null,
            graph: collectOptions?.graph,
            gatewayErrors: gatewayErrors
              ?.map(err =>
                toTrackedError(
                  err,
                  args.schema,
                  args.document,
                  isAbortAction(result) ? undefined : result.data,
                ),
              )
              .filter(e => !!e),
          });
        },
      };
    },
    async collectSubscription({ args, experimental__persistedDocumentHash, graph }) {
      const document = args.document;
      const rootOperation = document.definitions.find(
        o => o.kind === Kind.OPERATION_DEFINITION,
      ) as OperationDefinitionNode;
      const providedOperationName = args.operationName || rootOperation.name?.value;
      const operationName = providedOperationName || 'anonymous';
      // Check if operationName is a match with any string or regex in exclusions
      const isMatch = exclusions.some(excludingValue =>
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
              graph: toGraphMetadata(graph),
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
    lru<CacheResult>(max, ttl),
  );
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

export interface Report {
  size: number;
  map: OperationMap;
  operations?: RequestOperation[];
  subscriptionOperations?: SubscriptionOperation[];
}

type OperationSubRequest = {
  /** Delta start time from "timestamp" */
  start: number;

  /** How long the request took */
  duration: number;

  /** HTTP Status Code. Optional if resolved locally. */
  status?: number | undefined;

  /** Number of times the field has been requested. Regardless of success or failure */
  fields: { [coordinate: string]: number };

  /** Error code for a coordinate, with a code returned from the graphql extensions */
  errors?: { coordinate: string; code?: string }[];

  /** Which subgraph resolved this path */
  subgraph: string;

  /**
   * If this is an entity request, then this is the coordinate in the original operation that is being resolved.
   * If undefined, then the path is assumed to be 'Query'.
   */
  paths: string[] | string;

  /**
   * What type of request this is. Root is if resolving a root query/mutation field. Entity is
   * if resolving an entity type in federation.
   * */
  type: 'ROOT' | 'ENTITY';
};

type CollectedOperationSubRequest = {
  /** Delta start time from "timestamp" */
  start: number;

  /** How long the request took */
  duration: number;

  /** HTTP Status Code. Optional for if resolved locally */
  status?: number | undefined;

  /** The graphql execution result. Used to calculate error code for a coordinate, with a code returned from the graphql extensions */
  result?: GraphQLResult;

  /** The GraphQL schema being accessed. Used to calculate coordinate from error path and the coordinate for field counts */
  subgraphSchema: GraphQLSchema;

  /** GraphQL operation document. Used to calculate field counts. */
  document: DocumentNode;

  /** Which subgraph resolved this path */
  subgraph: string;

  /**
   * If this is an entity request, then this is the coordinate in the original operation that is being resolved.
   * If undefined, then the path is assumed to be 'Query'.
   */
  paths?: string[] | string;

  /**
   * What type of request this is. Root is if resolving a root query/mutation field. Entity is
   * if resolving an entity type in federation.
   * */
  type: 'ROOT' | 'ENTITY';
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
    fetches?: CollectedOperationSubRequest[] | null;
    gatewayErrors?: TrackedGraphQLError[] | null;
  };
  persistedDocumentHash?: string;
  client?: ClientInfo | null;
  graph?: GraphVersionInfo;
}

interface CollectedSubscriptionOperation {
  key: string;
  timestamp: number;
  operation: string;
  operationName?: string | null;
  fields: string[];
  persistedDocumentHash?: string;
  client?: ClientInfo | null;
  graph?: GraphVersionInfo;
}

interface RequestOperation {
  operationMapKey: string;
  timestamp: number;
  execution: {
    ok: boolean;
    duration: number;
    errorsTotal: number;
    fetches?: OperationSubRequest[] | null;
    gatewayErrors?: TrackedGraphQLError[] | null;
  };
  persistedDocumentHash?: string;
  metadata?: {
    client?: ClientInfo;
    graph?: GraphVersionInfo;
  };
}

interface SubscriptionOperation {
  operationMapKey: string;
  timestamp: number;
  persistedDocumentHash?: string;
  metadata?: {
    client?: ClientInfo;
    graph?: GraphVersionInfo;
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

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const defaultClientNameHeaders = ['x-graphql-client-name', 'graphql-client-name'];
const defaultClientVersionHeaders = ['x-graphql-client-version', 'graphql-client-version'];

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

function lookupHeader(
  headerGetter: (name: string) => string | null | undefined,
  possibleNames: Set<string>,
): string | null {
  for (const name of possibleNames) {
    const value = headerGetter(name);
    if (typeof value === 'string') {
      return value;
    }
  }
  return null;
}

function createDefaultClientInfo(
  config?: CreateDefaultClientInfo,
): (context: unknown) => ClientInfo | null {
  const clientNameHeaders = new Set(
    config?.http?.clientHeaderName
      ? [config.http.clientHeaderName, ...defaultClientNameHeaders]
      : defaultClientNameHeaders,
  );
  const clientVersionHeaders = new Set(
    config?.http?.versionHeaderName
      ? [config.http.versionHeaderName, ...defaultClientVersionHeaders]
      : defaultClientVersionHeaders,
  );
  const clientFieldName = config?.ws?.clientFieldName ?? 'client';
  return function defaultClientInfo(context: any) {
    // whatwg Request
    if (typeof context?.request?.headers?.get === 'function') {
      const headerGetter = (name: string) => context?.request?.headers?.get(name);
      const name = lookupHeader(headerGetter, clientNameHeaders);
      const version = lookupHeader(headerGetter, clientVersionHeaders);
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
      const headerGetter = (name: string) => context.req.headers[name];
      const name = lookupHeader(headerGetter, clientNameHeaders);
      const version = lookupHeader(headerGetter, clientVersionHeaders);
      if (typeof name === 'string' && typeof version === 'string') {
        return {
          name,
          version,
        };
      }

      return null;
    }

    // Plain headers object
    if (context?.headers && typeof context.headers === 'object') {
      const headerGetter = (name: string) => context.headers[name];
      const name = lookupHeader(headerGetter, clientNameHeaders);
      const version = lookupHeader(headerGetter, clientVersionHeaders);
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
