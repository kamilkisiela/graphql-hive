import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DocumentNode,
  ExecutionResult,
  getOperationAST,
  GraphQLError,
  Kind,
  parse,
  type GraphQLSchema,
} from 'graphql';
import { decompressFromEncodedURIComponent } from 'lz-string';
import { v4 as uuidv4 } from 'uuid';
import { isAsyncIterable, untilAborted } from '@/lib/utils';
import { SubscriptionProtocol, UrlLoader } from '@graphql-tools/url-loader';
import { LaboratoryPermission, LaboratoryPermissions } from '../components/laboratory/context';
import type {
  LaboratoryCollectionOperation,
  LaboratoryCollectionsActions,
  LaboratoryCollectionsState,
} from './collections';
import type { LaboratoryEnv, LaboratoryEnvActions, LaboratoryEnvState } from './env';
import {
  addArgToField,
  addPathToQuery,
  deletePathFromQuery,
  getOperationName,
  handleTemplate,
  mergeHeaders,
  removeArgFromField,
} from './operations.utils';
import { LaboratoryPlugin, LaboratoryPluginsActions, LaboratoryPluginsState } from './plugins';
import type { LaboratoryPreflightActions, LaboratoryPreflightState } from './preflight';
import type { LaboratorySettingsActions, LaboratorySettingsState } from './settings';
import type { LaboratoryTabOperation, LaboratoryTabsActions, LaboratoryTabsState } from './tabs';

function getOperationType(query: string): 'query' | 'mutation' | 'subscription' | null {
  try {
    return getOperationAST(parse(query))?.operation ?? null;
  } catch {
    return null;
  }
}

export interface LaboratoryOperation {
  id: string;
  name: string;
  query: string;
  variables: string;
  headers: string;
  extensions: string;
}

export interface LaboratoryOperationsState {
  operations: LaboratoryOperation[];
  activeOperation: LaboratoryOperation | null;
}

export interface LaboratoryOperationsActions {
  setActiveOperation: (operationId: string) => void;
  addOperation: (
    operation: Omit<LaboratoryOperation, 'id'> & { id?: string },
  ) => LaboratoryOperation;
  setOperations: (operations: LaboratoryOperation[]) => void;
  /** Renames an operation in place once the host has stored it under its own id. */
  replaceOperationId: (previousId: string, id: string) => void;
  updateActiveOperation: (operation: Partial<Omit<LaboratoryOperation, 'id'>>) => void;
  deleteOperation: (operationId: string) => void;
  /** With a schema, an abstract field is given `__typename` so it is never selection-less. */
  addPathToActiveOperation: (
    path: string,
    operationName?: string | null,
    schema?: GraphQLSchema,
  ) => void;
  deletePathFromActiveOperation: (path: string, operationName?: string | null) => void;
  addArgToActiveOperation: (
    path: string,
    argName: string,
    schema: GraphQLSchema,
    operationName?: string | null,
  ) => void;
  deleteArgFromActiveOperation: (
    path: string,
    argName: string,
    operationName?: string | null,
  ) => void;
  runActiveOperation: (
    endpoint: string,
    options?: {
      env?: LaboratoryEnv;
      headers?: Record<string, string>;
      operationName?: string;
      onResponse?: (response: string) => void;
    },
  ) => Promise<ExecutionResult | null>;
  stopActiveOperation: (() => void) | null;
  isActiveOperationLoading: boolean;
  isOperationLoading: (operationId: string) => boolean;
  isOperationSubscription: (operation: LaboratoryOperation) => boolean;
  isActiveOperationSubscription: boolean;
}

export interface LaboratoryOperationsCallbacks {
  onOperationCreate?: (operation: LaboratoryOperation) => void;
  onOperationUpdate?: (operation: LaboratoryOperation) => void;
  onOperationDelete?: (operation: LaboratoryOperation) => void;
}

const getOperationWithFragments = (
  document: DocumentNode,
  operationName?: string,
): DocumentNode => {
  const definitions = document.definitions.filter(definition => {
    if (
      definition.kind === Kind.OPERATION_DEFINITION &&
      operationName &&
      definition.name?.value !== operationName
    ) {
      return false;
    }
    return true;
  });

  return {
    kind: Kind.DOCUMENT,
    definitions,
  };
};

export const useOperations = (
  props: {
    checkPermissions: (
      permission: `${keyof LaboratoryPermissions & string}:${keyof LaboratoryPermission & string}`,
    ) => boolean;
    defaultOperations?: LaboratoryOperation[];
    defaultActiveOperationId?: string;
    onOperationsChange?: (operations: LaboratoryOperation[]) => void;
    onActiveOperationIdChange?: (operationId: string) => void;
    collectionsApi?: LaboratoryCollectionsState & LaboratoryCollectionsActions;
    tabsApi?: LaboratoryTabsState & LaboratoryTabsActions;
    envApi?: LaboratoryEnvState & LaboratoryEnvActions;
    preflightApi?: LaboratoryPreflightState & LaboratoryPreflightActions;
    settingsApi?: LaboratorySettingsState & LaboratorySettingsActions;
    pluginsApi?: LaboratoryPluginsState & LaboratoryPluginsActions;
  } & LaboratoryOperationsCallbacks,
): LaboratoryOperationsState & LaboratoryOperationsActions => {
  const [operations, _setOperations] = useState<LaboratoryOperation[]>(
    props.defaultOperations ?? [],
  );

  const activeOperation = useMemo(() => {
    const tab = props.tabsApi?.activeTab;

    if (!tab) {
      return null;
    }

    if (tab.type === 'operation') {
      return operations.find(o => o.id === (tab.data as LaboratoryTabOperation).id) ?? null;
    }

    return null;
  }, [props.tabsApi, operations]);

  const setActiveOperation = useCallback(
    (operationId: string) => {
      const tab =
        props.tabsApi?.tabs.find(
          t => t.type === 'operation' && (t.data as LaboratoryTabOperation).id === operationId,
        ) ?? null;

      if (!tab) {
        return;
      }

      props.tabsApi?.setActiveTab(tab);
    },
    [props.tabsApi],
  );

  const setOperations = useCallback(
    (operations: LaboratoryOperation[]) => {
      _setOperations(operations);
      props.onOperationsChange?.(operations);
    },
    [props],
  );

  // Persisted ids arrive after the fact, so the rename reads the latest state, not a closure.
  const operationsRef = useRef(operations);
  operationsRef.current = operations;

  const replaceOperationId = useCallback(
    (previousId: string, id: string) => {
      const newOperations = operationsRef.current.map(o =>
        o.id === previousId ? { ...o, id } : o,
      );
      _setOperations(newOperations);
      props.onOperationsChange?.(newOperations);
    },
    [props],
  );

  const addOperation = useCallback(
    (operation: Omit<LaboratoryOperation, 'id'> & { id?: string }) => {
      const newOperation = { id: uuidv4(), ...operation };
      const newOperations = [...operations, newOperation];
      _setOperations(newOperations);
      props.onOperationsChange?.(newOperations);

      props.onOperationCreate?.(newOperation);

      return newOperation;
    },
    [operations, props],
  );

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const share = urlParams.get('share');

    if (share) {
      const payload = decompressFromEncodedURIComponent(share);

      if (payload) {
        const { n, q, v, h, e } = JSON.parse(payload);

        const operation = addOperation({
          name: n,
          query: q,
          variables: v,
          headers: h,
          extensions: e,
        });

        const tab = props.tabsApi?.addTab({
          type: 'operation',
          data: operation,
        });

        if (tab) {
          props.tabsApi?.setActiveTab(tab);
        }

        const searchParams = new URLSearchParams(window.location.search);
        searchParams.delete('share');
        window.history.replaceState(
          null,
          '',
          window.location.pathname + '?' + searchParams.toString(),
        );
      }
    }
  }, []);

  const updateActiveOperation = useCallback(
    (operation: Partial<Omit<LaboratoryOperation, 'id'>>) => {
      const updatedOperation = { ...activeOperation, ...operation };

      if (updatedOperation.query) {
        const parsedName = getOperationName(updatedOperation.query);

        if (parsedName) {
          updatedOperation.name = parsedName;
        }
      }

      const newOperations = operations.map(o =>
        o.id === activeOperation?.id ? (updatedOperation as LaboratoryOperation) : o,
      );

      _setOperations(newOperations);

      props.onOperationsChange?.(newOperations);
      if (updatedOperation.id) {
        props.onOperationUpdate?.(updatedOperation as LaboratoryOperation);
      }

      if (
        props.collectionsApi &&
        props.checkPermissions?.('collectionsOperations:update') &&
        activeOperation?.id
      ) {
        const collectionId =
          props.collectionsApi.collections.find(c =>
            c.operations.some(o => o.id === activeOperation.id),
          )?.id ?? '';

        props.collectionsApi.updateOperationInCollection(
          collectionId,
          activeOperation.id,
          updatedOperation as LaboratoryCollectionOperation,
        );
      }
    },
    [activeOperation, operations, props.checkPermissions, props.collectionsApi],
  );

  const deleteOperation = useCallback(
    (operationId: string) => {
      const operationToDelete = operations.find(o => o.id === operationId);
      const newOperations = operations.filter(o => o.id !== operationId);
      _setOperations(newOperations);

      props.onOperationsChange?.(newOperations);
      if (operationToDelete) {
        props.onOperationDelete?.(operationToDelete);
      }

      if (activeOperation?.id === operationId) {
        setActiveOperation(newOperations[0]?.id ?? '');
      }
    },
    [activeOperation, operations, props, setActiveOperation],
  );

  const addPathToActiveOperation = useCallback(
    (path: string, operationName?: string | null, schema?: GraphQLSchema) => {
      if (!activeOperation) {
        return;
      }
      const newActiveOperation = {
        ...activeOperation,
        query: addPathToQuery(activeOperation.query, path, operationName, schema),
      };
      updateActiveOperation(newActiveOperation);
    },
    [activeOperation, updateActiveOperation],
  );

  const deletePathFromActiveOperation = useCallback(
    (path: string, operationName?: string | null) => {
      if (!activeOperation?.query) {
        return;
      }

      const newActiveOperation = {
        ...activeOperation,
        query: deletePathFromQuery(activeOperation.query, path, operationName),
      };
      updateActiveOperation(newActiveOperation);
    },
    [activeOperation, updateActiveOperation],
  );

  const addArgToActiveOperation = useCallback(
    (path: string, argName: string, schema: GraphQLSchema, operationName?: string | null) => {
      if (!activeOperation?.query) {
        return;
      }

      const newActiveOperation = {
        ...activeOperation,
        query: addArgToField(activeOperation.query, path, argName, schema, operationName),
      };
      updateActiveOperation(newActiveOperation);
    },
    [activeOperation, updateActiveOperation],
  );

  const deleteArgFromActiveOperation = useCallback(
    (path: string, argName: string, operationName?: string | null) => {
      if (!activeOperation?.query) {
        return;
      }

      const newActiveOperation = {
        ...activeOperation,
        query: removeArgFromField(activeOperation.query, path, argName, operationName),
      };
      updateActiveOperation(newActiveOperation);
    },
    [activeOperation, updateActiveOperation],
  );

  const [stopOperationsFunctions, setStopOperationsFunctions] = useState<
    Record<string, () => void>
  >({});

  const isOperationLoading = useCallback(
    (operationId: string) => {
      return Object.keys(stopOperationsFunctions).includes(operationId);
    },
    [stopOperationsFunctions],
  );

  const isActiveOperationLoading = useMemo(() => {
    return activeOperation ? isOperationLoading(activeOperation.id) : false;
  }, [activeOperation, isOperationLoading]);

  const loader = useMemo(() => new UrlLoader(), []);

  const runActiveOperation = useCallback(
    async (
      endpoint: string,
      options?: {
        env?: LaboratoryEnv;
        headers?: Record<string, string>;
        onResponse?: (response: string) => void;
        operationName?: string;
      },
      plugins: LaboratoryPlugin[] = props.pluginsApi?.plugins ?? [],
      pluginsState: Record<string, any> = props.pluginsApi?.pluginsState ?? {},
    ): Promise<ExecutionResult | null> => {
      if (!activeOperation?.query) {
        return null;
      }

      let env: LaboratoryEnv;
      let headers: Record<string, string>;

      if (options?.env) {
        env = options.env;
        headers = options.headers ?? {};
      } else {
        const preflightResult = await props.preflightApi?.runPreflight?.(plugins, pluginsState);
        env = preflightResult?.env ?? { variables: {} };
        headers = preflightResult?.headers ?? {};

        // Null means preflight is disabled, not that it produced empty state.
        if (preflightResult) {
          pluginsState = preflightResult.pluginsState;
          props.pluginsApi?.setPluginsState(pluginsState);
        }
      }

      if (env && Object.keys(env?.variables ?? {}).length > 0) {
        props.envApi?.setEnv(env);
      } else {
        env = props.envApi?.env ?? { variables: {} };
      }

      const parsedHeaders = activeOperation.headers
        ? JSON.parse(
            handleTemplate(activeOperation.headers, {
              ...env.variables,
              plugins: pluginsState,
            }),
          )
        : {};

      const mergedHeaders = mergeHeaders(parsedHeaders, headers);

      const variables = activeOperation.variables
        ? JSON.parse(
            handleTemplate(activeOperation.variables, {
              ...env.variables,
              plugins: pluginsState,
            }),
          )
        : {};
      const extensions = activeOperation.extensions
        ? JSON.parse(
            handleTemplate(activeOperation.extensions, {
              ...env.variables,
              plugins: pluginsState,
            }),
          )
        : {};

      const executor = loader.getExecutorAsync(endpoint, {
        subscriptionsEndpoint: endpoint,
        subscriptionsProtocol:
          (props.settingsApi?.settings.subscriptions.protocol as SubscriptionProtocol) ??
          SubscriptionProtocol.GRAPHQL_SSE,
        credentials: props.settingsApi?.settings.fetch.credentials,
        specifiedByUrl: true,
        directiveIsRepeatable: true,
        inputValueDeprecation: true,
        timeout: props.settingsApi?.settings.fetch.timeout,
        useGETForQueries: props.settingsApi?.settings.fetch.useGETForQueries,
        exposeHTTPDetailsInExtensions: true,
        fetch,
      });

      const document = getOperationWithFragments(parse(activeOperation.query));

      const abortController = new AbortController();

      setStopOperationsFunctions(prev => ({
        ...prev,
        [activeOperation.id]: () => {
          abortController.abort('Operation aborted by user');
        },
      }));

      try {
        const response = await executor({
          document,
          operationName: options?.operationName,
          variables,
          extensions: {
            ...extensions,
            headers: mergedHeaders,
          },
          signal: abortController.signal,
        });

        if (isAsyncIterable(response)) {
          try {
            for await (const item of untilAborted(response, abortController.signal)) {
              options?.onResponse?.(JSON.stringify(item ?? {}));
            }
          } finally {
            setStopOperationsFunctions(prev => {
              const newStopOperationsFunctions = { ...prev };
              delete newStopOperationsFunctions[activeOperation.id];
              return newStopOperationsFunctions;
            });
          }

          return null;
        }

        if (response.extensions?.response?.body) {
          delete response.extensions.response.body;
        }

        setStopOperationsFunctions(prev => {
          const newStopOperationsFunctions = { ...prev };
          delete newStopOperationsFunctions[activeOperation.id];
          return newStopOperationsFunctions;
        });

        return response;
      } catch (error) {
        setStopOperationsFunctions(prev => {
          const newStopOperationsFunctions = { ...prev };
          delete newStopOperationsFunctions[activeOperation.id];
          return newStopOperationsFunctions;
        });

        if (abortController.signal.aborted) {
          return null;
        }

        if (error instanceof Error) {
          return new GraphQLError(error.message);
        }

        return new GraphQLError('An unknown error occurred');
      }
    },
    [activeOperation, props.preflightApi, props.envApi, props.pluginsApi, props.settingsApi],
  );

  const isOperationSubscription = useCallback((operation: LaboratoryOperation) => {
    return getOperationType(operation.query) === 'subscription';
  }, []);

  const isActiveOperationSubscription = useMemo(() => {
    return activeOperation ? isOperationSubscription(activeOperation) : false;
  }, [activeOperation, isOperationSubscription]);

  return {
    operations,
    setOperations,
    replaceOperationId,
    runActiveOperation,
    setActiveOperation,
    activeOperation,
    addOperation,
    updateActiveOperation,
    deleteOperation,
    addPathToActiveOperation,
    deletePathFromActiveOperation,
    addArgToActiveOperation,
    deleteArgFromActiveOperation,
    isActiveOperationLoading,
    stopActiveOperation: stopOperationsFunctions[activeOperation?.id ?? ''],
    isActiveOperationSubscription,
    isOperationSubscription,
    isOperationLoading,
  };
};
