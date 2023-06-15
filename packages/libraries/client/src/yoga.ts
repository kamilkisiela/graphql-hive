import { DocumentNode, GraphQLSchema, parse } from 'graphql';
import type { Plugin } from 'graphql-yoga';
import LRU from 'tiny-lru';
import { createHive } from './client.js';
import type { CollectUsageCallback, HiveClient, HivePluginOptions } from './internal/types.js';
import { isHiveClient } from './internal/utils.js';

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

  const lru = LRU<DocumentNode>(10_000);
  let latestSchema: GraphQLSchema | null = null;
  const cache = new WeakMap<Request, CollectUsageCallback>();

  return {
    onSchemaChange({ schema }) {
      hive.reportSchema({ schema });
      latestSchema = schema;
    },
    onParams(context) {
      if (context.params.query && latestSchema) {
        try {
          let document = lru.get(context.params.query);
          if (document === undefined) {
            document = parse(context.params.query);
            lru.set(context.params.query, document);
          }
          const callback = hive.collectUsage({
            document,
            operationName: context.params.operationName,
            schema: latestSchema,
          });
          cache.set(context.request, callback);
        } catch {
          // ignore
        }
      }
    },
    onResultProcess(context) {
      const callback = cache.get(context.request);
      if (callback) {
        // we don't support batching :)
        if (Array.isArray(context.result) === false) {
          callback(context.result as any);
        }
      }
    },
  };
}
