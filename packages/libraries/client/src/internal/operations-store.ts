import axios from 'axios';
import type { DocumentNode } from 'graphql';
import { parse, stripIgnoredCharacters } from 'graphql';
import { version } from '../version.js';
import type { HivePluginOptions } from './types.js';

export interface OperationsStore {
  canHandle(key: string): boolean;
  get(key: string): DocumentNode | null;
  load(): Promise<void>;
  reload(): Promise<void>;
}

export function createOperationsStore(pluginOptions: HivePluginOptions): OperationsStore {
  const operationsStoreOptions = pluginOptions.operationsStore;
  const selfHostingOptions = pluginOptions.selfHosting;
  const token = pluginOptions.token;

  if (!operationsStoreOptions || pluginOptions.enabled === false) {
    return {
      canHandle() {
        return false;
      },
      get() {
        return null;
      },
      async load() {},
      async reload() {},
    };
  }

  const store = new Map<string, DocumentNode>();

  const canHandle: OperationsStore['canHandle'] = key => {
    return typeof key === 'string' && !key.includes('{');
  };

  const get: OperationsStore['get'] = key => {
    return store.get(key)!;
  };

  const load: OperationsStore['load'] = async () => {
    const response = await axios.post(
      selfHostingOptions?.graphqlEndpoint ??
        operationsStoreOptions.endpoint ??
        'https://app.graphql-hive.com/graphql',
      {
        query,
        operationName: 'loadStoredOperations',
      },
      {
        responseType: 'json',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${token}`,
          'graphql-client-name': 'Hive Client',
          'graphql-client-version': version,
        },
      },
    );

    const parsedData: {
      data: {
        storedOperations: Array<{
          key: string;
          document: string;
        }>;
      };
    } = await response.data;

    store.clear();

    parsedData.data.storedOperations.forEach(({ key, document }) => {
      store.set(
        key,
        parse(document, {
          noLocation: true,
        }),
      );
    });
  };

  const reload: OperationsStore['reload'] = load;

  return {
    canHandle,
    get,
    load,
    reload,
  };
}

const query = stripIgnoredCharacters(/* GraphQL */ `
  query loadStoredOperations {
    storedOperations {
      key: operationHash
      document: content
    }
  }
`);
