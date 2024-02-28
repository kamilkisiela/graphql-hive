import type { Plugin } from '@envelop/types';
import { createHive } from './client.js';
import type { HiveClient, HivePluginOptions } from './internal/types.js';
import { isHiveClient } from './internal/utils.js';

export function useHive(clientOrOptions: HiveClient): Plugin;
export function useHive(clientOrOptions: HivePluginOptions): Plugin;
export function useHive(clientOrOptions: HiveClient | HivePluginOptions): Plugin {
  const hive = isHiveClient(clientOrOptions)
    ? clientOrOptions
    : createHive({
        ...clientOrOptions,
        agent: {
          name: 'hive-client-envelop',
          ...clientOrOptions.agent,
        },
      });

  void hive.info();

  if (!isHiveClient(clientOrOptions)) {
    for (const signal of ['SIGINT', 'SIGTERM'] as const) {
      process.once(signal, () => {
        hive.dispose();
      });
    }
  }

  return {
    onSchemaChange({ schema }) {
      hive.reportSchema({ schema });
    },
    onExecute({ args }) {
      const complete = hive.collectUsage();

      return {
        onExecuteDone({ result }) {
          complete(args, result);
        },
      };
    },
  };
}
