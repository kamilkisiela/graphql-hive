import type { Plugin } from '@envelop/types';
import type { HiveClient, HivePluginOptions } from './internal/types';
import { createHive } from './client';
import { isHiveClient } from './internal/utils';

export function useHive(clientOrOptions: HiveClient): Plugin;
export function useHive(clientOrOptions: HivePluginOptions): Plugin;
export function useHive(clientOrOptions: HiveClient | HivePluginOptions): Plugin {
  const hive = isHiveClient(clientOrOptions)
    ? clientOrOptions
    : createHive({
        ...clientOrOptions,
        agent: {
          name: 'hive-client-envelop',
          ...(clientOrOptions.agent ?? {}),
        },
      });

  void hive.info();

  return {
    onSchemaChange({ schema }) {
      hive.reportSchema({ schema });
    },
    onExecute({ args }) {
      const complete = hive.collectUsage(args);

      return {
        onExecuteDone({ result }) {
          complete(result);
        },
      };
    },
  };
}
