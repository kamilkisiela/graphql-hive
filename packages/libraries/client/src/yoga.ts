import { DocumentNode, ExecutionArgs, GraphQLSchema, Kind, parse } from 'graphql';
import type { GraphQLParams, Plugin } from 'graphql-yoga';
import LRU from 'tiny-lru';
import { createHive } from './client.js';
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
        onExecuteDone({ args }) {
          const record = cache.get(args.contextValue.request);
          if (record) {
            record.executionArgs = args;
          }
        },
      };
    },
    onResultProcess(context) {
      const record = cache.get(context.request);
      if (!record || Array.isArray(context.result)) {
        return;
      }

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

      if (!record.paramsArgs.query || !latestSchema) {
        return;
      }

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
      } catch {
        // ignore
      }
    },
  };
}
