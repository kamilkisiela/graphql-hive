import {
  DocumentNode,
  ExecutionArgs,
  GraphQLSchema,
  Kind,
  parse,
  type GraphQLError,
} from 'graphql';
import type { GraphQLParams, Plugin } from 'graphql-yoga';
import LRU from 'tiny-lru';
import { isAsyncIterable } from '@graphql-tools/utils';
import { autoDisposeSymbol, createHive } from './client.js';
import type { CollectUsageCallback, HiveClient, HivePluginOptions } from './internal/types.js';
import { isHiveClient } from './internal/utils.js';

type CacheRecord = {
  callback: CollectUsageCallback;
  paramsArgs: GraphQLParams;
  executionArgs?: ExecutionArgs;
  parsedDocument?: DocumentNode;
};

export function useHive(clientOrOptions: HiveClient): Plugin;
export function useHive(clientOrOptions: HivePluginOptions): Plugin;
export function useHive(clientOrOptions: HiveClient | HivePluginOptions): Plugin {
  const hive = isHiveClient(clientOrOptions)
    ? clientOrOptions
    : createHive({
        ...clientOrOptions,
        agent: {
          name: 'hive-client-yoga',
          ...clientOrOptions.agent,
        },
      });

  void hive.info();

  if (hive[autoDisposeSymbol]) {
    if (global.process) {
      const signals = Array.isArray(hive[autoDisposeSymbol])
        ? hive[autoDisposeSymbol]
        : ['SIGINT', 'SIGTERM'];
      for (const signal of signals) {
        process.once(signal, () => hive.dispose());
      }
    } else {
      console.error(
        'It seems that GraphQL Hive is not being executed in Node.js. ' +
          'Please attempt manual client disposal and use autoDispose: false option.',
      );
    }
  }

  const parsedDocumentCache = LRU<DocumentNode>(10_000);
  let latestSchema: GraphQLSchema | null = null;
  const cache = new WeakMap<Request, CacheRecord>();

  return {
    onSchemaChange({ schema }) {
      hive.reportSchema({ schema });
      latestSchema = schema;
    },
    onParams(context) {
      if (context.params.query && latestSchema) {
        cache.set(context.request, {
          callback: hive.collectUsage(),
          paramsArgs: context.params,
        });
      }
    },
    // since response-cache modifies the executed GraphQL document, we need to extract it after parsing.
    onParse(parseCtx) {
      return ctx => {
        if (ctx.result.kind === Kind.DOCUMENT) {
          const record = cache.get(ctx.context.request);
          if (record) {
            record.parsedDocument = ctx.result;
            parsedDocumentCache.set(parseCtx.params.source, ctx.result);
          }
        }
      };
    },
    onExecute() {
      return {
        onExecuteDone({ args, result }) {
          const record = cache.get(args.contextValue.request);
          if (!record) {
            return;
          }

          record.executionArgs = args;

          if (!isAsyncIterable(result)) {
            return;
          }

          const errors: GraphQLError[] = [];

          return {
            onNext(ctx) {
              if (!ctx.result.errors) {
                return;
              }
              errors.push(...ctx.result.errors);
            },
            onEnd() {
              record.callback(args, { errors });
            },
          };
        },
      };
    },
    onSubscribe(context) {
      return {
        onSubscribeResult() {
          hive.collectSubscriptionUsage({ args: context.args });
        },
      };
    },
    onResultProcess(context) {
      const record = cache.get(context.request);

      if (!record || Array.isArray(context.result) || isAsyncIterable(context.result)) {
        return;
      }

      // Report if execution happened (aka executionArgs have been set within onExecute)
      if (record.executionArgs) {
        record.callback(
          {
            ...record.executionArgs,
            document: record.parsedDocument ?? record.executionArgs.document,
          },
          context.result,
        );
        return;
      }

      // Report if execution was skipped due to response cache ( Symbol.for('servedFromResponseCache') in context.result)
      if (
        record.paramsArgs.query &&
        latestSchema &&
        Symbol.for('servedFromResponseCache') in context.result
      ) {
        try {
          let document = parsedDocumentCache.get(record.paramsArgs.query);
          if (document === undefined) {
            document = parse(record.paramsArgs.query);
            parsedDocumentCache.set(record.paramsArgs.query, document);
          }
          record.callback(
            {
              document,
              schema: latestSchema,
              variableValues: record.paramsArgs.variables,
              operationName: record.paramsArgs.operationName,
            },
            context.result,
          );
        } catch (err) {
          console.error(err);
        }
      }
    },
  };
}
