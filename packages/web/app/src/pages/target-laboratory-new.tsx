import { useCallback, useEffect, useMemo, useState } from 'react';
import { buildSchema, introspectionFromSchema, Kind, parse, print } from 'graphql';
import { throttle } from 'lodash';
import { toast } from 'sonner';
import { useMutation, useQuery } from 'urql';
import { LayoutContent } from '@/components/layouts/layout-content';
import { ConnectLabModal } from '@/components/target/laboratory/connect-lab-modal';
import { useTheme } from '@/components/theme/theme-provider';
import { DocsLink } from '@/components/ui/docs-note';
import { Meta } from '@/components/ui/meta';
import { Subtitle, Title } from '@/components/ui/page';
import { Button } from '@/components/ui/primitives/button/button';
import { Dialog } from '@/components/ui/primitives/overlays/dialog/dialog';
import { ToggleGroup } from '@/components/ui/primitives/toggle-group/toggle-group';
import { graphql, useFragment } from '@/gql';
import { TargetEnvPlugin } from '@/laboratory/plugins/target-env';
import { useLocalStorage, useSlugs, useToggle } from '@/lib/hooks';
import { useCurrentOperationWithFetchingState } from '@/lib/hooks/laboratory/use-current-operation';
import { TargetLaboratoryPageQuery } from '@/lib/hooks/laboratory/use-operation-collections-plugin';
import { useOperationFromQueryString } from '@/lib/hooks/laboratory/useOperationFromQueryString';
import { useResetState } from '@/lib/hooks/use-reset-state';
import { loadHistory, saveHistory } from '@/lib/laboratory-history-storage';
import { migrateLegacyLaboratoryStorage } from '@/lib/laboratory-legacy-storage';
import { withLinkedOperation } from '@/lib/laboratory-linked-operation';
import {
  Laboratory,
  LaboratoryCollection,
  LaboratoryCollectionOperation,
  LaboratoryEnv,
  LaboratoryHistory,
  LaboratoryOperation,
  LaboratoryPreflight,
  LaboratorySettings,
  LaboratoryTab,
} from '@graphql-hive/laboratory';
import { getRouteApi, Link as RouterLink, useRouter } from '@tanstack/react-router';

function useApiTabValueState(graphqlEndpointUrl: string | null) {
  const [state, setState] = useResetState<'mockApi' | 'linkedApi'>(() => {
    const value = localStorage.getItem('hive:laboratory-tab-value');
    if (!value || !['mockApi', 'linkedApi'].includes(value)) {
      return graphqlEndpointUrl ? 'linkedApi' : 'mockApi';
    }

    if (value === 'linkedApi' && graphqlEndpointUrl) {
      return 'linkedApi';
    }

    return 'mockApi';
  }, [graphqlEndpointUrl]);

  return [
    state,
    useCallback(
      (state: 'mockApi' | 'linkedApi') => {
        localStorage.setItem('hive:laboratory-tab-value', state);
        setState(state);
      },
      [setState],
    ),
  ] as const;
}

const laboratoryRoute = getRouteApi(
  '/authenticated/with-header/$organizationSlug/$projectSlug/$targetSlug/laboratory',
);

const localStoragePrefix = 'hive:laboratory:';

const getLocalStorageState = (key: string, defaultValue: any) => {
  const value = localStorage.getItem(`${localStoragePrefix}${key}`);
  return value ? JSON.parse(value) : defaultValue;
};

const setLocalStorageState = (key: string, value: any) => {
  localStorage.setItem(`${localStoragePrefix}${key}`, JSON.stringify(value));
};

export const LaboratoryPreflightScriptTargetFragment = graphql(`
  fragment LaboratoryPreflightScriptTargetFragment on Target {
    id
    preflightScript {
      id
      sourceCode
    }
    viewerCanModifyPreflightScript
  }
`);

export const LaboratoryQuery = graphql(`
  query Laboratory($selector: TargetSelectorInput!) {
    target(reference: { bySelector: $selector }) {
      id
      documentCollections {
        edges {
          cursor
          node {
            id
            name
            description
            operations(first: 100) {
              edges {
                node {
                  id
                  name
                  query
                  variables
                  headers
                }
                cursor
              }
            }
          }
        }
      }
      ...LaboratoryPreflightScriptTargetFragment
      viewerCanModifyLaboratory
    }
  }
`);

export const CreateCollectionMutation = graphql(`
  mutation LaboratoryCreateCollection(
    $selector: TargetSelectorInput!
    $input: CreateDocumentCollectionInput!
  ) {
    createDocumentCollection(selector: $selector, input: $input) {
      error {
        message
      }
      ok {
        updatedTarget {
          id
          documentCollections {
            edges {
              cursor
              node {
                id
                name
              }
            }
          }
        }
        collection {
          id
          name
          operations(first: 100) {
            edges {
              cursor
              node {
                id
                name
              }
              cursor
            }
          }
        }
      }
    }
  }
`);

const UpdateCollectionMutation = graphql(`
  mutation LaboratoryUpdateCollection(
    $selector: TargetSelectorInput!
    $input: UpdateDocumentCollectionInput!
  ) {
    updateDocumentCollection(selector: $selector, input: $input) {
      error {
        message
      }
      ok {
        collection {
          id
          name
          description
        }
      }
    }
  }
`);

const UpdateOperationMutation = graphql(`
  mutation LaboratoryUpdateOperation(
    $selector: TargetSelectorInput!
    $input: UpdateDocumentCollectionOperationInput!
  ) {
    updateOperationInDocumentCollection(selector: $selector, input: $input) {
      error {
        message
      }
      ok {
        operation {
          id
          name
          query
          variables
          headers
        }
      }
    }
  }
`);

const CreateOperationMutation = graphql(`
  mutation LaboratoryCreateOperation(
    $selector: TargetSelectorInput!
    $input: CreateDocumentCollectionOperationInput!
  ) {
    createOperationInDocumentCollection(selector: $selector, input: $input) {
      error {
        message
      }
      ok {
        operation {
          id
          name
        }
        updatedTarget {
          id
          documentCollections {
            edges {
              cursor
              node {
                id
                operations {
                  edges {
                    node {
                      id
                    }
                    cursor
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`);

export const DeleteCollectionMutation = graphql(`
  mutation LaboratoryDeleteCollection($selector: TargetSelectorInput!, $id: ID!) {
    deleteDocumentCollection(selector: $selector, id: $id) {
      error {
        message
      }
      ok {
        deletedId
        updatedTarget {
          id
          documentCollections {
            edges {
              cursor
              node {
                id
              }
            }
          }
        }
      }
    }
  }
`);

export const DeleteOperationMutation = graphql(`
  mutation LaboratoryDeleteOperation($selector: TargetSelectorInput!, $id: ID!) {
    deleteOperationInDocumentCollection(selector: $selector, id: $id) {
      error {
        message
      }
      ok {
        deletedId
        updatedTarget {
          id
          documentCollections {
            edges {
              cursor
              node {
                id
                operations {
                  edges {
                    node {
                      id
                    }
                    cursor
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`);

export const UpdatePreflightScriptMutation = graphql(`
  mutation LaboratoryUpdatePreflightScript($input: UpdatePreflightScriptInput!) {
    updatePreflightScript(input: $input) {
      ok {
        updatedTarget {
          id
          preflightScript {
            id
            sourceCode
          }
        }
      }
      error {
        message
      }
    }
  }
`);

function useLaboratoryState() {
  // Idempotent, so it can run on every render ahead of the reads below.
  migrateLegacyLaboratoryStorage();

  const { organizationSlug, projectSlug, targetSlug } = useSlugs('target');
  const [{ data, fetching: dataFetching }] = useQuery({
    query: LaboratoryQuery,
    variables: {
      selector: {
        targetSlug,
        organizationSlug,
        projectSlug,
      },
    },
  });

  const [historyData, setHistoryData] = useState<LaboratoryHistory[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadHistory().then(history => {
      if (!cancelled) setHistoryData(history);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const preflight = useFragment(LaboratoryPreflightScriptTargetFragment, data?.target ?? null);

  const collections = useMemo(
    () =>
      data?.target?.documentCollections.edges
        .map(v => v.node)
        .map(
          collection =>
            ({
              id: collection.id,
              name: collection.name,
              createdAt: new Date().toISOString(),
              operations: collection.operations.edges
                .map(v => v.node)
                .map(
                  operation =>
                    ({
                      id: operation.id,
                      name: operation.name,
                      query: operation.query,
                      variables: operation.variables ?? '{}',
                      headers: operation.headers ?? '{}',
                      extensions: '{}',
                      description: '',
                      createdAt: new Date().toISOString(),
                    }) satisfies LaboratoryCollectionOperation,
                ),
            }) satisfies LaboratoryCollection,
        ),
    [data?.target?.documentCollections.edges],
  );

  const [, mutateUpdate] = useMutation(UpdateOperationMutation);

  const updateOperation = useMemo(
    () =>
      throttle((collection: LaboratoryCollection, operation: LaboratoryCollectionOperation) => {
        void mutateUpdate({
          selector: {
            targetSlug,
            organizationSlug,
            projectSlug,
          },
          input: {
            operationId: operation.id,
            collectionId: collection.id,
            name: operation.name,
            query: operation.query,
            variables: operation.variables,
            headers: operation.headers,
          },
        });
      }, 1000),
    [mutateUpdate, targetSlug, organizationSlug, projectSlug],
  );

  const [, mutateCreate] = useMutation(CreateOperationMutation);

  // Not throttled: the lab adopts the stored id this resolves with.
  const createOperation = useCallback(
    async (collection: LaboratoryCollection, operation: LaboratoryCollectionOperation) => {
      const result = await mutateCreate({
        selector: {
          targetSlug,
          organizationSlug,
          projectSlug,
        },
        input: {
          collectionId: collection.id,
          name: operation.name,
          query: operation.query,
          variables: operation.variables,
          headers: operation.headers,
        },
      });

      const id = result.data?.createOperationInDocumentCollection.ok?.operation.id;

      return id ? { id } : undefined;
    },
    [mutateCreate, targetSlug, organizationSlug, projectSlug],
  );

  const [, mutateDelete] = useMutation(DeleteOperationMutation);

  const deleteOperation = useMemo(
    () =>
      throttle((_collection: LaboratoryCollection, operation: LaboratoryCollectionOperation) => {
        void mutateDelete({
          selector: {
            targetSlug,
            organizationSlug,
            projectSlug,
          },
          id: operation.id,
        });
      }, 1000),
    [mutateDelete, targetSlug, organizationSlug, projectSlug],
  );

  const [, mutateDeleteCollection] = useMutation(DeleteCollectionMutation);
  const deleteCollection = useMemo(
    () =>
      throttle((collection: LaboratoryCollection) => {
        void mutateDeleteCollection({
          selector: {
            targetSlug,
            organizationSlug,
            projectSlug,
          },
          id: collection.id,
        });
      }, 1000),
    [mutateDeleteCollection, targetSlug, organizationSlug, projectSlug],
  );

  const [, mutateAddCollection] = useMutation(CreateCollectionMutation);

  const addCollection = useCallback(
    async (collection: LaboratoryCollection) => {
      const result = await mutateAddCollection({
        selector: {
          targetSlug,
          organizationSlug,
          projectSlug,
        },
        input: {
          name: collection.name,
          description: collection.description,
        },
      });

      const id = result.data?.createDocumentCollection.ok?.collection.id;

      return id ? { id } : undefined;
    },
    [mutateAddCollection, targetSlug, organizationSlug, projectSlug],
  );

  const [, mutateUpdateCollection] = useMutation(UpdateCollectionMutation);
  const updateCollection = useMemo(
    () =>
      throttle((collection: LaboratoryCollection) => {
        void mutateUpdateCollection({
          selector: {
            targetSlug,
            organizationSlug,
            projectSlug,
          },
          input: {
            collectionId: collection.id,
            name: collection.name,
            description: collection.description,
          },
        });
      }, 1000),
    [mutateUpdateCollection, targetSlug, organizationSlug, projectSlug],
  );

  const [, mutateUpdatePreflight] = useMutation(UpdatePreflightScriptMutation);

  const updatePreflight = useMemo(
    () =>
      throttle((preflight: LaboratoryPreflight) => {
        void mutateUpdatePreflight({
          input: {
            selector: {
              targetSlug,
              organizationSlug,
              projectSlug,
            },
            sourceCode: preflight.script,
          },
        });
      }, 1000),
    [mutateUpdatePreflight, targetSlug, organizationSlug, projectSlug],
  );

  const { currentOperation, fetching: currentOperationFetching } =
    useCurrentOperationWithFetchingState({
      organizationSlug,
      projectSlug,
      targetSlug,
    });

  const router = useRouter();
  const { search } = router.latestLocation;
  const operationString =
    'operationString' in search && typeof search.operationString === 'string'
      ? search.operationString
      : null;

  const navigate = laboratoryRoute.useNavigate();

  // A persisted-document link imports once; the param must not survive a reload.
  useEffect(() => {
    if (operationString) {
      void navigate({ search: prev => ({ ...prev, operationString: undefined }), replace: true });
    }
  }, [navigate, operationString]);

  const operationFromQueryString = useMemo(() => {
    if (operationString) {
      try {
        const parsed = parse(operationString);
        const name = parsed.definitions.find(v => v.kind === Kind.OPERATION_DEFINITION)?.name
          ?.value;

        return {
          id: crypto.randomUUID(),
          name: name ?? 'Untitled',
          query: print(parsed),
          variables: '{}',
          headers: '{}',
          extensions: '{}',
        } satisfies LaboratoryOperation;
      } catch (error) {
        console.error(error);
        return null;
      }
    }

    return null;
  }, [operationString]);

  const linkedState = useMemo(() => {
    const stored = {
      operations: getLocalStorageState('operations', []),
      tabs: getLocalStorageState('tabs', []),
      activeTabId: getLocalStorageState('activeTabId', null),
    };

    if (operationFromQueryString) {
      return withLinkedOperation(stored, operationFromQueryString, 'content');
    }

    if (currentOperation) {
      return withLinkedOperation(
        stored,
        {
          id: currentOperation.id,
          name: currentOperation.name,
          query: currentOperation.query,
          variables: currentOperation.variables ?? '{}',
          headers: currentOperation.headers ?? '{}',
          extensions: '{}',
        },
        'id',
      );
    }

    return stored;
  }, [currentOperation, operationFromQueryString]);

  const operationIdFromSearch = useOperationFromQueryString();

  const fetching = useMemo(() => {
    if (historyData === null) {
      return true;
    }
    if (operationIdFromSearch) {
      return dataFetching || currentOperationFetching;
    }

    return dataFetching;
  }, [dataFetching, currentOperationFetching, operationIdFromSearch, historyData]);

  return {
    fetching,
    defaultCollections: collections,
    defaultOperations: linkedState.operations,
    defaultHistory: historyData ?? [],
    defaultTabs: linkedState.tabs,
    defaultActiveTabId: linkedState.activeTabId,
    defaultSettings: getLocalStorageState('settings', null),
    defaultPreflight: preflight?.preflightScript?.sourceCode
      ? {
          script: preflight.preflightScript.sourceCode,
          enabled: getLocalStorageState('preflightEnabled', false),
        }
      : null,
    defaultEnv: getLocalStorageState('env', {}),
    onEnvChange: (env: LaboratoryEnv | null) => {
      setLocalStorageState('env', env);
    },
    defaultPluginsState: getLocalStorageState('pluginsState', {}),
    onPluginsStateChange: (pluginsState: Record<string, any>) => {
      setLocalStorageState('pluginsState', pluginsState);
    },
    onOperationsChange: (operations: LaboratoryOperation[]) => {
      setLocalStorageState('operations', operations);
    },
    onHistoryChange: (history: LaboratoryHistory[]) => {
      void saveHistory(history);
    },
    onTabsChange: (tabs: LaboratoryTab[]) => {
      setLocalStorageState('tabs', tabs);
    },
    onActiveTabIdChange: (activeTabId: string | null) => {
      setLocalStorageState('activeTabId', activeTabId);
    },
    onCollectionOperationCreate: (
      collection: LaboratoryCollection,
      operation: LaboratoryCollectionOperation,
    ) => createOperation(collection, operation),
    onCollectionOperationUpdate: (
      collection: LaboratoryCollection,
      operation: LaboratoryCollectionOperation,
    ) => {
      updateOperation(collection, operation);
    },
    onCollectionOperationDelete: (
      collection: LaboratoryCollection,
      operation: LaboratoryCollectionOperation,
    ) => {
      deleteOperation(collection, operation);
    },
    onCollectionDelete: (collection: LaboratoryCollection) => {
      deleteCollection(collection);
    },
    onCollectionCreate: (collection: LaboratoryCollection) => addCollection(collection),
    onCollectionUpdate: (collection: LaboratoryCollection) => {
      updateCollection(collection);
    },
    onSettingsChange: (settings: LaboratorySettings | null) => {
      setLocalStorageState('settings', settings);
    },
    onPreflightChange: (preflight: LaboratoryPreflight | null) => {
      updatePreflight(preflight ?? { script: '', enabled: true });
      setLocalStorageState('preflightEnabled', preflight?.enabled ?? false);
    },
    // One script per target, stored server side, so it is not private to the person editing it.
    preflightNotice:
      'It is stored in plain text on this target, where everyone with access can read it and it runs in their browser too.',
    permissions: {
      preflight: {
        update: preflight?.viewerCanModifyPreflightScript === true,
      },
      collections: {
        create: data?.target?.viewerCanModifyLaboratory === true,
        update: data?.target?.viewerCanModifyLaboratory === true,
        delete: data?.target?.viewerCanModifyLaboratory === true,
      },
      collectionsOperations: {
        create: data?.target?.viewerCanModifyLaboratory === true,
        update: data?.target?.viewerCanModifyLaboratory === true,
        delete: data?.target?.viewerCanModifyLaboratory === true,
      },
    },
  };
}

function LaboratoryPageContent(props: {
  selectedOperationId?: string;
  defaultLaboratoryTab: 'graphiql' | 'hive-laboratory';
  onLaboratoryTabChange: (tab: 'graphiql' | 'hive-laboratory') => void;
}) {
  const { organizationSlug, projectSlug, targetSlug } = useSlugs('target');
  const [query] = useQuery({
    query: TargetLaboratoryPageQuery,
    variables: {
      organizationSlug,
      projectSlug,
      targetSlug,
    },
  });

  const [actualSelectedApiEndpoint, setEndpointType] = useApiTabValueState(
    query.data?.target?.graphqlEndpointUrl ?? null,
  );

  const mockEndpoint = `${location.origin}/api/lab/${organizationSlug}/${projectSlug}/${targetSlug}`;

  const url =
    (actualSelectedApiEndpoint === 'linkedApi'
      ? query.data?.target?.graphqlEndpointUrl
      : undefined) ?? mockEndpoint;

  const laboratoryState = useLaboratoryState();

  const [isConnectLabModalOpen, toggleConnectLabModal] = useToggle();

  const { resolvedTheme } = useTheme();

  const sdl = query.data?.target?.latestSchemaVersion?.sdl;

  const introspection = useMemo(() => {
    if (!sdl) {
      return null;
    }

    try {
      return introspectionFromSchema(buildSchema(sdl));
    } catch (err) {
      toast.error('Failed to fetch schema', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
      return null;
    }
  }, [sdl]);

  if (laboratoryState.fetching) {
    return null;
  }

  return (
    <>
      <ConnectLabModal
        endpoint={mockEndpoint}
        close={toggleConnectLabModal}
        isOpen={isConnectLabModalOpen}
        isCDNEnabled={query.data ?? null}
      />
      <div className="flex size-full flex-col gap-3 py-6">
        <div className="flex">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Title>Laboratory</Title>
              <div className="h-4 w-px bg-line" />
              <ToggleGroup
                aria-label="Laboratory version"
                value={props.defaultLaboratoryTab}
                onValueChange={value =>
                  props.onLaboratoryTabChange(value as 'graphiql' | 'hive-laboratory')
                }
                options={[
                  { value: 'graphiql', label: 'GraphiQL' },
                  {
                    value: 'hive-laboratory',
                    label: (
                      <>
                        Hive Laboratory
                        <span className="ml-1 size-2 rounded-full bg-accent" />
                      </>
                    ),
                  },
                ]}
              />
            </div>
            <Subtitle>
              Explore your GraphQL schema and run queries against your GraphQL API.
            </Subtitle>
            <p>
              <DocsLink href="/schema-registry/laboratory" text="Learn more about the Laboratory" />
            </p>
          </div>
          <div className="mr-0 ml-auto flex flex-col justify-center">
            <div>
              {query.data && !query.data.target?.graphqlEndpointUrl ? (
                <RouterLink
                  to="/$organizationSlug/$projectSlug/$targetSlug/settings"
                  params={{
                    organizationSlug,
                    projectSlug,
                    targetSlug,
                  }}
                >
                  <Button variant="outline" size="compact">
                    Connect GraphQL API Endpoint
                  </Button>
                </RouterLink>
              ) : null}
              <Button onClick={toggleConnectLabModal} variant="ghost" size="compact">
                Mock Data Endpoint
              </Button>
            </div>
            <div className="self-end pt-2">
              <span className="mr-2 text-xs font-bold">Query</span>
              <ToggleGroup
                options={[
                  {
                    value: 'mockApi',
                    label: 'Mock',
                    tooltip: 'Use Mock Schema',
                    disabled: query.fetching,
                  },
                  {
                    value: 'linkedApi',
                    label: 'API',
                    tooltip: 'Use API endpoint',
                    disabled: !query.data?.target?.graphqlEndpointUrl || query.fetching,
                  },
                ]}
                value={actualSelectedApiEndpoint}
                onValueChange={newValue => {
                  setEndpointType(newValue as 'mockApi' | 'linkedApi');
                }}
                aria-label="Query endpoint"
              />
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-hidden rounded-lg border">
          <Laboratory
            key={url}
            defaultEndpoint={url}
            theme={resolvedTheme}
            defaultSchemaIntrospection={introspection}
            enableDocs
            {...laboratoryState}
            plugins={[
              TargetEnvPlugin({
                organizationSlug,
                projectSlug,
                targetSlug,
              }),
            ]}
          />
        </div>
      </div>
    </>
  );
}

export function TargetLaboratoryPage(props: {
  selectedOperationId: string | undefined;
  defaultLaboratoryTab: 'graphiql' | 'hive-laboratory';
  onLaboratoryTabChange: (tab: 'graphiql' | 'hive-laboratory') => void;
}) {
  const [isWelcomeDialogShown, setIsWelcomeDialogShown] = useLocalStorage(
    'hive:laboratory:welcome-dialog-shown',
    'false',
  );

  // Read once: the effect below marks it shown on the first render, so the dialog owns its own
  // open state from then on.
  const [welcomeOpen, setWelcomeOpen] = useState(isWelcomeDialogShown === 'false');

  useEffect(() => {
    if (isWelcomeDialogShown === 'false') {
      setIsWelcomeDialogShown('true');
    }
  }, [isWelcomeDialogShown]);

  return (
    <>
      <Meta title="Schema laboratory" />
      <Dialog
        open={welcomeOpen}
        onOpenChange={setWelcomeOpen}
        width="sm"
        title="Welcome to new Hive Laboratory"
        description="Hive Laboratory is a new way to explore your GraphQL schema and run queries against your GraphQL API."
        footer={
          <Button onSurface="raised" onClick={() => setWelcomeOpen(false)}>
            Get started
          </Button>
        }
      >
        <p className="text-sm text-fg-default">
          You always can switch to the old GraphiQL based Laboratory by using the tab switcher in
          the top left cornder.
        </p>
      </Dialog>
      <LayoutContent className="flex h-(--content-height) flex-col pb-0">
        <LaboratoryPageContent {...props} />
      </LayoutContent>
    </>
  );
}
