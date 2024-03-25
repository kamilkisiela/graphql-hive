import {
  ArgumentNode,
  ASTNode,
  DocumentNode,
  getNamedType,
  GraphQLInputType,
  GraphQLInterfaceType,
  GraphQLNamedType,
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLType,
  GraphQLUnionType,
  isEnumType,
  isInputObjectType,
  isScalarType,
  Kind,
  NameNode,
  ObjectFieldNode,
  OperationDefinitionNode,
  TypeInfo,
  visit,
  visitWithTypeInfo,
  type ExecutionArgs,
} from 'graphql';
import LRU from 'tiny-lru';
import { normalizeOperation } from '@graphql-hive/core';
import { version } from '../version.js';
import { createAgent } from './agent.js';
import { dynamicSampling, randomSampling } from './sampling.js';
import type {
  AbortAction,
  ClientInfo,
  CollectUsageCallback,
  HivePluginOptions,
  HiveUsagePluginOptions,
} from './types.js';
import { cache, cacheDocumentKey, logIf, measureDuration, memo } from './utils.js';

interface UsageCollector {
  collect(): CollectUsageCallback;
  collectSubscription(args: { args: ExecutionArgs }): void;
  dispose(): Promise<void>;
}

function isAbortAction(result: Parameters<CollectUsageCallback>[1]): result is AbortAction {
  return 'action' in result && result.action === 'abort';
}

export function createUsage(pluginOptions: HivePluginOptions): UsageCollector {
  if (!pluginOptions.usage || pluginOptions.enabled === false) {
    return {
      collect() {
        return () => {};
      },
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
  const logger = pluginOptions.agent?.logger ?? console;
  const collector = memo(createCollector, arg => arg.schema);
  const excludeSet = new Set(options.exclude ?? []);
  const agent = createAgent<AgentAction>(
    {
      logger,
      ...(pluginOptions.agent ?? {
        maxSize: 1500,
      }),
      endpoint:
        selfHostingOptions?.usageEndpoint ??
        options.endpoint ??
        'https://app.graphql-hive.com/usage',
      token: pluginOptions.token,
      enabled: pluginOptions.enabled,
      debug: pluginOptions.debug,
    },
    {
      prefix: 'usage',
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
            });
          } else if (action.type === 'subscription') {
            const operation = action.data;
            reportSubscriptionOperations.push({
              operationMapKey: operation.key,
              timestamp: operation.timestamp,
              metadata: {
                client: operation.client ?? undefined,
              },
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
          'Content-Type': 'application/json',
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
    '[hive][usage] token is missing',
    logger.error,
  );

  const shouldInclude =
    options.sampler && typeof options.sampler === 'function'
      ? dynamicSampling(options.sampler)
      : randomSampling(options.sampleRate ?? 1.0);

  return {
    dispose: agent.dispose,
    collect() {
      const finish = measureDuration();

      return function complete(args, result) {
        const duration = finish();
        let providedOperationName: string | undefined = undefined;
        try {
          if (isAbortAction(result)) {
            if (result.logging) {
              logger.info(result.reason);
            }
            return;
          }

          const document = args.document;
          const rootOperation = document.definitions.find(
            o => o.kind === Kind.OPERATION_DEFINITION,
          ) as OperationDefinitionNode;
          providedOperationName = args.operationName || rootOperation.name?.value;
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
            const errors =
              result.errors?.map(error => ({
                message: error.message,
                path: error.path?.join('.'),
              })) ?? [];
            const collect = collector({
              schema: args.schema,
              max: options.max ?? 1000,
              ttl: options.ttl,
              processVariables: options.processVariables ?? false,
            });
            const { key, value: info } = collect(document, args.variableValues ?? null);
            agent.capture({
              type: 'request',
              data: {
                key,
                timestamp: Date.now(),
                operationName,
                operation: info.document,
                fields: info.fields,
                execution: {
                  ok: errors.length === 0,
                  duration,
                  errorsTotal: errors.length,
                  errors,
                },
                // TODO: operationHash is ready to accept hashes of persisted operations
                client:
                  typeof args.contextValue !== 'undefined' &&
                  typeof options.clientInfo !== 'undefined'
                    ? options.clientInfo(args.contextValue)
                    : createDefaultClientInfo()(args.contextValue),
              },
            });
          }
        } catch (error) {
          const details = providedOperationName ? ` (name: "${providedOperationName}")` : '';
          logger.error(`Failed to collect operation${details}`, error);
        }
      };
    },
    collectSubscription({ args }) {
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
        const { key, value: info } = collect(document, args.variableValues ?? null);

        agent.capture({
          type: 'subscription',
          data: {
            key,
            timestamp: Date.now(),
            operationName,
            operation: info.document,
            fields: info.fields,
            // TODO: operationHash is ready to accept hashes of persisted operations
            client:
              typeof args.contextValue !== 'undefined' && typeof options.clientInfo !== 'undefined'
                ? options.clientInfo(args.contextValue)
                : createDefaultClientInfo()(args.contextValue),
          },
        });
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
    const entries = new Set<string>();
    const collected_entire_named_types = new Set<string>();
    const shouldAnalyzeVariableValues = processVariables === true && variables !== null;

    function markAsUsed(id: string) {
      if (!entries.has(id)) {
        entries.add(id);
      }
    }

    function makeId(...names: string[]): string {
      return names.join('.');
    }

    const collectedInputTypes: Record<
      string,
      {
        all: boolean;
        fields: Set<string>;
      }
    > = {};

    function collectInputType(inputType: string, fieldName?: string) {
      if (!collectedInputTypes[inputType]) {
        collectedInputTypes[inputType] = {
          all: false,
          fields: new Set<string>(),
        };
      }

      if (fieldName) {
        collectedInputTypes[inputType].fields.add(fieldName);
      } else {
        collectedInputTypes[inputType].all = true;
      }
    }

    function collectNode(node: ObjectFieldNode | ArgumentNode) {
      const inputType = typeInfo.getInputType()!;
      const inputTypeName = resolveTypeName(inputType);

      if (node.value.kind === Kind.ENUM) {
        // Collect only a specific enum value
        collectInputType(inputTypeName, node.value.value);
      } else if (node.value.kind !== Kind.OBJECT && node.value.kind !== Kind.LIST) {
        // When processing of variables is enabled,
        // we want to skip collecting full input types of variables
        // and only collect specific fields.
        // That's why the following condition is added.
        // Otherwise we would mark entire input types as used, and not granular fields.
        if (node.value.kind === Kind.VARIABLE && shouldAnalyzeVariableValues) {
          return;
        }

        collectInputType(inputTypeName);
      }
    }

    function markEntireTypeAsUsed(type: GraphQLInputType): void {
      const namedType = getNamedType(type);

      if (collected_entire_named_types.has(namedType.name)) {
        // No need to mark this type as used again
        return;
      }
      // Add this type to the set of types that have been marked as used
      // to avoid infinite loops
      collected_entire_named_types.add(namedType.name);

      if (isScalarType(namedType)) {
        markAsUsed(makeId(namedType.name));
        return;
      }

      if (isEnumType(namedType)) {
        namedType.getValues().forEach(value => {
          markAsUsed(makeId(namedType.name, value.name));
        });
        return;
      }

      const fieldsMap = namedType.getFields();

      for (const fieldName in fieldsMap) {
        const field = fieldsMap[fieldName];

        markAsUsed(makeId(namedType.name, field.name));
        markEntireTypeAsUsed(field.type);
      }
    }

    function collectVariable(namedType: GraphQLNamedInputType, variableValue: unknown) {
      const variableValueArray = Array.isArray(variableValue) ? variableValue : [variableValue];
      if (isInputObjectType(namedType)) {
        variableValueArray.forEach(variable => {
          if (variable) {
            // Collect only the used fields
            for (const fieldName in variable) {
              const field = namedType.getFields()[fieldName];
              if (field) {
                collectInputType(namedType.name, fieldName);
                collectVariable(getNamedType(field.type), variable[fieldName]);
              }
            }
          } else {
            // Collect type without fields
            markAsUsed(makeId(namedType.name));
          }
        });
      } else {
        collectInputType(namedType.name);
      }
    }

    visit(
      doc,
      visitWithTypeInfo(typeInfo, {
        Field(node, _key, _parent, path, ancestors) {
          const parent = typeInfo.getParentType();
          const field = typeInfo.getFieldDef();

          if (!parent) {
            throw new Error(
              `Could not find a parent type of a field at ${printPath(path, ancestors, node.name)}`,
            );
          }

          if (!field) {
            throw new Error(
              `Could not find a field definition of a field at ${printPath(
                path,
                ancestors,
                node.name,
              )}`,
            );
          }

          markAsUsed(makeId(parent.name, field.name));
        },
        VariableDefinition(node) {
          const inputType = typeInfo.getInputType();

          if (!inputType) {
            throw new Error(`Could not find an input type of a variable $${node.variable.name}`);
          }

          if (shouldAnalyzeVariableValues) {
            // Granular collection of variable values is enabled
            const variableName = node.variable.name.value;
            const variableValue = variables[variableName];
            const namedType = getNamedType(inputType);

            collectVariable(namedType, variableValue);
          } else {
            // Collect the entire type without processing the variables
            collectInputType(resolveTypeName(inputType));
          }
        },
        Directive(node) {
          return {
            ...node,
            arguments: [],
          };
        },
        Argument(node, _key, _parent, path, ancestors) {
          const parent = typeInfo.getParentType();
          const field = typeInfo.getFieldDef();
          const arg = typeInfo.getArgument();

          if (!parent) {
            throw new Error(
              `Could not find a parent type of an argument at ${printPath(
                path,
                ancestors,
                node.name,
              )}`,
            );
          }

          if (!field) {
            throw new Error(
              `Could not find a field definition of an argument at ${printPath(
                path,
                ancestors,
                node.name,
              )}`,
            );
          }

          if (!arg) {
            throw new Error(
              `Could not find an argument definition of an argument at ${printPath(
                path,
                ancestors,
                node.name,
              )}`,
            );
          }

          markAsUsed(makeId(parent.name, field.name, arg.name));
          collectNode(node);
        },
        ListValue(node, _key, _parent, path, ancestors) {
          const inputType = typeInfo.getInputType();

          if (!inputType) {
            throw new Error(
              `Could not find an input type of a list value at ${printPath(path, ancestors)}`,
            );
          }

          const inputTypeName = resolveTypeName(inputType);

          node.values.forEach(value => {
            if (value.kind !== Kind.OBJECT) {
              // if a value is not an object we need to collect all fields
              collectInputType(inputTypeName);
            }
          });
        },
        ObjectField(node, _key, _parent, path, ancestors) {
          const parentInputType = typeInfo.getParentInputType();

          if (!parentInputType) {
            throw new Error(
              `Could not find an input type of an object field at ${printPath(
                path,
                ancestors,
                node.name,
              )}`,
            );
          }

          const parentInputTypeName = resolveTypeName(parentInputType);

          collectNode(node);
          collectInputType(parentInputTypeName, node.name.value);
        },
      }),
    );

    for (const inputTypeName in collectedInputTypes) {
      const { fields, all } = collectedInputTypes[inputTypeName];

      if (all) {
        markEntireTypeAsUsed(schema.getType(inputTypeName) as any);
      } else {
        fields.forEach(field => {
          markAsUsed(makeId(inputTypeName, field));
        });
      }
    }

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

function resolveTypeName(inputType: GraphQLType): string {
  return getNamedType(inputType).name;
}

function printPath(
  path: readonly (string | number)[],
  ancestors: readonly (ASTNode | readonly ASTNode[])[],
  leafNameNode?: NameNode,
): string {
  const result: string[] = [];
  for (let i = 0; i < path.length; i++) {
    const key = path[i];
    const ancestor = ancestors[i];

    if (!ancestor) {
      break;
    }

    if (key === 'selectionSet') {
      if ('name' in ancestor && ancestor.name?.value) {
        result.push(ancestor.name.value);
      }
    }
  }

  if (leafNameNode) {
    result.push(leafNameNode.value);
  }

  return result.join('.');
}

type GraphQLNamedInputType = Exclude<
  GraphQLNamedType,
  GraphQLObjectType | GraphQLInterfaceType | GraphQLUnionType
>;

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
  client?: ClientInfo | null;
}

interface CollectedSubscriptionOperation {
  key: string;
  timestamp: number;
  operation: string;
  operationName?: string | null;
  fields: string[];
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
