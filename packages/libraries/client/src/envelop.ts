import type { Plugin } from '@envelop/types';
import { autoDisposeSymbol, createHive } from './client.js';
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

  if (hive[autoDisposeSymbol]) {
    if (!global.process) {
      throw TypeError(
        'It seems that GraphQL Hive is not being executed in Node.js. ' +
          'Please attempt manual client disposal and use autoDispose: false option.',
      );
    }
    const signals = Array.isArray(hive[autoDisposeSymbol])
      ? hive[autoDisposeSymbol]
      : ['SIGINT', 'SIGTERM'];
    for (const signal of signals) {
      process.once(signal, () => hive.dispose());
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
