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
  const cache = new WeakMap<Request, [CollectUsageCallback, ...Array<CollectUsageCallback>]>();

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

          let callbacks = cache.get(context.request);
          if (callbacks === undefined) {
            callbacks = [callback];
            cache.set(context.request, callbacks);
            return;
          }

          callbacks.push(callback);
        } catch {
          // ignore
        }
      }
    },
    onResultProcess(context) {
      const callbacks = cache.get(context.request);
      if (callbacks) {
        if (Array.isArray(context.result)) {
          for (const result of context.result) {
            callbacks.shift()!(result as any);
          }
        } else {
          callbacks[0](context.result as any);
        }
      }
    },
  };
}
