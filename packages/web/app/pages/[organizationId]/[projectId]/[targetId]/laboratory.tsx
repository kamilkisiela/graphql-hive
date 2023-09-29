import { ReactElement, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { GraphiQL } from 'graphiql';
import { buildSchema } from 'graphql';
import { useMutation, useQuery } from 'urql';
import { authenticated } from '@/components/authenticated-container';
import { Page, TargetLayout } from '@/components/layouts/target';
import { ConnectLabModal } from '@/components/target/laboratory/connect-lab-modal';
import { CreateCollectionModal } from '@/components/target/laboratory/create-collection-modal';
import { CreateOperationModal } from '@/components/target/laboratory/create-operation-modal';
import { DeleteCollectionModal } from '@/components/target/laboratory/delete-collection-modal';
import { DeleteOperationModal } from '@/components/target/laboratory/delete-operation-modal';
import { Button } from '@/components/ui/button';
import { Subtitle, Title } from '@/components/ui/page';
import {
  Accordion,
  DocsLink,
  Link,
  MetaTitle,
  Spinner,
  ToggleGroup,
  ToggleGroupItem,
  Tooltip,
} from '@/components/v2';
import { HiveLogo, PlusIcon, SaveIcon, ShareIcon } from '@/components/v2/icon';
import { graphql } from '@/gql';
import { TargetAccessScope } from '@/gql/graphql';
import { canAccessTarget } from '@/lib/access/target';
import { useClipboard, useNotifications, useRouteSelector, useToggle } from '@/lib/hooks';
import { withSessionProtection } from '@/lib/supertokens/guard';
import { cn } from '@/lib/utils';
import {
  Button as GraphiQLButton,
  DropdownMenu as GraphiQLDropdownMenu,
  GraphiQLPlugin,
  Tooltip as GraphiQLTooltip,
  useEditorContext,
} from '@graphiql/react';
import { createGraphiQLFetcher, Fetcher, isAsyncIterable } from '@graphiql/toolkit';
import { BookmarkIcon, DotsVerticalIcon } from '@radix-ui/react-icons';
import 'graphiql/graphiql.css';
import NextLink from 'next/link';
import { cx } from 'class-variance-authority';
import clsx from 'clsx';
import { EditOperationModal } from '@/components/target/laboratory/edit-operation-modal';
import { QueryError } from '@/components/ui/query-error';
import { useResetState } from '@/lib/hooks/use-reset-state';
import { Repeater } from '@repeaterjs/repeater';

function Share(): ReactElement {
  const label = 'Share query';
  const copyToClipboard = useClipboard();
  const router = useRouter();

  return (
    <GraphiQLTooltip label={label}>
      <GraphiQLButton
        className="graphiql-toolbar-button"
        aria-label={label}
        disabled={!router.query.operation}
        onClick={async () => {
          await copyToClipboard(window.location.href);
        }}
      >
        <ShareIcon className="graphiql-toolbar-icon" />
      </GraphiQLButton>
    </GraphiQLTooltip>
  );
}

const OperationQuery = graphql(`
  query Operation($selector: TargetSelectorInput!, $id: ID!) {
    target(selector: $selector) {
      id
      documentCollectionOperation(id: $id) {
        id
        name
        query
        headers
        variables
        collection {
          id
        }
      }
    }
  }
`);

function useCurrentOperation() {
  const router = useRouteSelector();
  const operationId = router.query.operation as string;
  const [{ data }] = useQuery({
    query: OperationQuery,
    variables: {
      selector: {
        target: router.targetId,
        project: router.projectId,
        organization: router.organizationId,
      },
      id: operationId,
    },
    pause: !operationId,
  });
  // if operationId is undefined `data` could contain previous state
  return operationId ? data?.target?.documentCollectionOperation : null;
}

const CreateOperationMutation = graphql(`
  mutation CreateOperation(
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

const CollectionItem = (props: {
  node: { id: string; name: string };
  canDelete: boolean;
  canEdit: boolean;
  onDelete: (operationId: string) => void;
  onEdit: (operationId: string) => void;
}): ReactElement => {
  const router = useRouteSelector();
  const copyToClipboard = useClipboard();

  return (
    <div key={props.node.id} className="flex justify-between items-center">
      <Link
        href={{
          pathname: '/[organizationId]/[projectId]/[targetId]/laboratory/[operationId]',
          query: {
            organizationId: router.organizationId,
            projectId: router.projectId,
            targetId: router.targetId,
            operationId: props.node.id,
          },
        }}
        className={cn(
          'hover:bg-gray-100/10 w-full rounded p-2 !text-gray-300',
          router.query.operation === props.node.id && 'bg-gray-100/10 text-white',
        )}
        onClick={ev => {
          ev.preventDefault();
          void router.push(
            {
              query: {
                operation: props.node.id,
                organizationId: router.organizationId,
                projectId: router.projectId,
                targetId: router.targetId,
              },
            },
            undefined,
            {
              scroll: false,
              shallow: true,
            },
          );
        }}
      >
        {props.node.name}
      </Link>
      <GraphiQLDropdownMenu
        // https://github.com/radix-ui/primitives/issues/1241#issuecomment-1580887090
        modal={false}
      >
        <GraphiQLDropdownMenu.Button
          className="graphiql-toolbar-button opacity-0 [div:hover>&]:opacity-100 transition [div:hover>&]:bg-transparent"
          aria-label="More"
          data-cy="operation-3-dots"
        >
          <DotsVerticalIcon />
        </GraphiQLDropdownMenu.Button>

        <GraphiQLDropdownMenu.Content>
          <GraphiQLDropdownMenu.Item
            onSelect={async () => {
              const url = new URL(window.location.href);
              await copyToClipboard(`${url.origin}${url.pathname}?operation=${props.node.id}`);
            }}
          >
            Copy link to operation
          </GraphiQLDropdownMenu.Item>
          {props.canEdit ? (
            <GraphiQLDropdownMenu.Item
              onSelect={async () => {
                props.onEdit(props.node.id);
              }}
            >
              Edit
            </GraphiQLDropdownMenu.Item>
          ) : null}
          {props.canDelete ? (
            <GraphiQLDropdownMenu.Item
              onSelect={() => {
                props.onDelete(props.node.id);
              }}
              className="!text-red-500"
              data-cy="remove-operation"
            >
              Delete
            </GraphiQLDropdownMenu.Item>
          ) : null}
        </GraphiQLDropdownMenu.Content>
      </GraphiQLDropdownMenu>
    </div>
  );
};

const AddCollectionItemButton = (props: { collectionId: string }): ReactElement => {
  const [createOperationState, createOperation] = useMutation(CreateOperationMutation);
  const router = useRouteSelector();
  const notify = useNotifications();

  return (
    <Button
      variant="link"
      className="py-0 px-2 text-gray-500 hover:text-white hover:no-underline"
      onClick={async () => {
        const result = await createOperation({
          input: {
            collectionId: props.collectionId,
            name: 'New Operation',
            query: '{}',
            headers: '',
            variables: '',
          },
          selector: {
            target: router.targetId,
            organization: router.organizationId,
            project: router.projectId,
          },
        });
        if (result.error) {
          notify("Couldn't create operation. Please try again later.", 'error');
        }
        if (result.data?.createOperationInDocumentCollection.error) {
          notify(result.data.createOperationInDocumentCollection.error.message, 'error');
        }
        if (result.data?.createOperationInDocumentCollection.ok) {
          void router.push(
            {
              query: {
                operation: result.data.createOperationInDocumentCollection.ok.operation.id,
                orgId: router.organizationId,
                projectId: router.projectId,
                targetId: router.targetId,
              },
            },
            undefined,
            {
              scroll: false,
              shallow: true,
            },
          );
        }
      }}
      disabled={createOperationState.fetching}
    >
      <PlusIcon size={10} className="mr-1 inline" /> Add Operation
    </Button>
  );
};

export const CollectionsQuery = graphql(`
  query Collections($selector: TargetSelectorInput!) {
    target(selector: $selector) {
      id
      documentCollections {
        edges {
          cursor
          node {
            id
            name
            operations(first: 100) {
              edges {
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
  }
`);

export function useCollections() {
  const router = useRouteSelector();
  const [{ data, error, fetching }] = useQuery({
    query: CollectionsQuery,
    variables: {
      selector: {
        target: router.targetId,
        organization: router.organizationId,
        project: router.projectId,
      },
    },
  });

  const notify = useNotifications();

  useEffect(() => {
    if (error) {
      notify(error.message, 'error');
    }
  }, [error]);

  return {
    collections: data?.target?.documentCollections.edges.map(v => v.node) || [],
    fetching,
  };
}

function useOperationCollectionsPlugin({
  canDelete,
  canEdit,
}: {
  canEdit: boolean;
  canDelete: boolean;
}): GraphiQLPlugin {
  return {
    title: 'Operation Collections',
    icon: BookmarkIcon,
    content: useCallback(
      function Content() {
        const [isCollectionModalOpen, toggleCollectionModal] = useToggle();
        const { collections, fetching: loading } = useCollections();
        const [collectionId, setCollectionId] = useState('');
        const [isDeleteCollectionModalOpen, toggleDeleteCollectionModalOpen] = useToggle();
        const [operationToDeleteId, setOperationToDeleteId] = useState<null | string>(null);
        const [operationToEditId, setOperationToEditId] = useState<null | string>(null);
        const router = useRouteSelector();

        const currentOperation = useCurrentOperation();
        const editorContext = useEditorContext({ nonNull: true });

        const hasAllEditors = !!(
          editorContext.queryEditor &&
          editorContext.variableEditor &&
          editorContext.headerEditor
        );

        const queryParamsOperationId = router.query.operation as string;

        useEffect(() => {
          if (!hasAllEditors) {
            return;
          }

          if (queryParamsOperationId && currentOperation) {
            // Set selected operation in editors
            editorContext.queryEditor.setValue(currentOperation.query);
            editorContext.variableEditor.setValue(currentOperation.variables);
            editorContext.headerEditor.setValue(currentOperation.headers);
          } else {
            // Clear editors if operation not selected
            editorContext.queryEditor.setValue('');
            editorContext.variableEditor.setValue('');
            editorContext.headerEditor.setValue('');
          }
        }, [hasAllEditors, queryParamsOperationId, currentOperation]);

        const shouldShowMenu = canEdit || canDelete;

        const initialSelectedCollection =
          currentOperation?.id &&
          collections?.find(c =>
            c.operations.edges.some(({ node }) => node.id === currentOperation.id),
          )?.id;

        return (
          <div className="h-full flex flex-col">
            <div className="flex justify-between">
              <Title>Collections</Title>
            </div>
            {loading ? (
              <div className="flex justify-center h-fit flex-1 items-center">
                <div className="flex items-center flex-col">
                  <Spinner />
                  <div className="text-xs mt-2">Loading collections</div>
                </div>
              </div>
            ) : collections?.length ? (
              <Accordion
                defaultValue={initialSelectedCollection ? [initialSelectedCollection] : undefined}
                className="mt-5 space-y-0"
                type="multiple"
              >
                {collections.map(collection => (
                  <Accordion.Item key={collection.id} value={collection.id}>
                    <div className="flex">
                      <Accordion.Header triggerClassName="pl-1">{collection.name}</Accordion.Header>
                      {shouldShowMenu ? (
                        <GraphiQLDropdownMenu
                          // https://github.com/radix-ui/primitives/issues/1241#issuecomment-1580887090
                          modal={false}
                        >
                          <GraphiQLDropdownMenu.Button
                            className="graphiql-toolbar-button !shrink-0"
                            aria-label="More"
                            data-cy="collection-3-dots"
                          >
                            <DotsVerticalIcon />
                          </GraphiQLDropdownMenu.Button>

                          <GraphiQLDropdownMenu.Content>
                            <GraphiQLDropdownMenu.Item
                              onSelect={() => {
                                setCollectionId(collection.id);
                                toggleCollectionModal();
                              }}
                              data-cy="collection-edit"
                            >
                              Edit
                            </GraphiQLDropdownMenu.Item>
                            <GraphiQLDropdownMenu.Item
                              onSelect={() => {
                                setCollectionId(collection.id);
                                toggleDeleteCollectionModalOpen();
                              }}
                              className="!text-red-500"
                              data-cy="collection-delete"
                            >
                              Delete
                            </GraphiQLDropdownMenu.Item>
                          </GraphiQLDropdownMenu.Content>
                        </GraphiQLDropdownMenu>
                      ) : null}
                    </div>
                    <Accordion.Content className="pr-0">
                      {collection.operations.edges.length
                        ? collection.operations.edges.map(({ node }) => (
                            <CollectionItem
                              key={node.id}
                              node={node}
                              canDelete={canDelete}
                              canEdit={canEdit}
                              onDelete={setOperationToDeleteId}
                              onEdit={setOperationToEditId}
                            />
                          ))
                        : null}
                      <AddCollectionItemButton collectionId={collection.id} />
                    </Accordion.Content>
                  </Accordion.Item>
                ))}
              </Accordion>
            ) : (
              <div className="flex justify-center h-fit flex-1 items-center">
                <div className="flex items-center flex-col">
                  <BookmarkIcon width={30} height={30} />
                  <div className="text-xs mt-2">There are no collections available.</div>
                  {canEdit ? (
                    <Button
                      onClick={() => {
                        if (collectionId) {
                          setCollectionId('');
                        }
                        toggleCollectionModal();
                      }}
                      data-cy="create-collection"
                      className="mt-3"
                    >
                      Create your first Collection.
                    </Button>
                  ) : null}
                </div>
              </div>
            )}
            <CreateCollectionModal
              isOpen={isCollectionModalOpen}
              toggleModalOpen={toggleCollectionModal}
              collectionId={collectionId}
            />
            <DeleteCollectionModal
              isOpen={isDeleteCollectionModalOpen}
              toggleModalOpen={toggleDeleteCollectionModalOpen}
              collectionId={collectionId}
            />
            {operationToDeleteId === null ? null : (
              <DeleteOperationModal
                close={() => setOperationToDeleteId(null)}
                operationId={operationToDeleteId}
              />
            )}
            {operationToEditId === null ? null : (
              <EditOperationModal
                key={operationToEditId}
                operationId={operationToEditId}
                close={() => setOperationToEditId(null)}
              />
            )}
          </div>
        );
      },
      [canEdit, canDelete],
    ),
  };
}

const UpdateOperationMutation = graphql(`
  mutation UpdateOperation(
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

function Save(): ReactElement {
  const [isOpen, toggle] = useToggle();
  const { collections } = useCollections();
  const notify = useNotifications();
  const routeSelector = useRouteSelector();
  const currentOperation = useCurrentOperation();
  const [, mutateUpdate] = useMutation(UpdateOperationMutation);
  const { queryEditor, variableEditor, headerEditor } = useEditorContext()!;
  const isSame =
    !!currentOperation &&
    currentOperation.query === queryEditor?.getValue() &&
    currentOperation.variables === variableEditor?.getValue() &&
    currentOperation.headers === headerEditor?.getValue();

  return (
    <>
      <GraphiQLDropdownMenu
        // https://github.com/radix-ui/primitives/issues/1241#issuecomment-1580887090
        modal={false}
      >
        <GraphiQLDropdownMenu.Button
          className="graphiql-toolbar-button"
          aria-label="More"
          data-cy="save-operation"
        >
          <SaveIcon className="graphiql-toolbar-icon !h-5 w-auto" />
        </GraphiQLDropdownMenu.Button>
        <GraphiQLDropdownMenu.Content>
          <GraphiQLDropdownMenu.Item
            disabled={isSame}
            className={cx(isSame && 'cursor-default hover:bg-transparent text-gray-400')}
            onClick={async () => {
              if (!currentOperation || isSame) {
                return;
              }
              const { error, data } = await mutateUpdate({
                selector: {
                  target: routeSelector.targetId,
                  organization: routeSelector.organizationId,
                  project: routeSelector.projectId,
                },
                input: {
                  name: currentOperation.name,
                  collectionId: currentOperation.collection.id,
                  query: queryEditor?.getValue(),
                  variables: variableEditor?.getValue(),
                  headers: headerEditor?.getValue(),
                  operationId: currentOperation.id,
                },
              });
              if (data) {
                notify('Updated!', 'success');
              }
              if (error) {
                notify(error.message, 'error');
              }
            }}
          >
            Save
          </GraphiQLDropdownMenu.Item>
          <GraphiQLDropdownMenu.Item
            onClick={async () => {
              if (!collections.length) {
                notify('Please create a collection first.', 'error');
                return;
              }
              toggle();
            }}
          >
            Save as
          </GraphiQLDropdownMenu.Item>
        </GraphiQLDropdownMenu.Content>
      </GraphiQLDropdownMenu>
      <CreateOperationModal isOpen={isOpen} close={toggle} />
    </>
  );
}

const TargetLaboratoryPageQuery = graphql(`
  query TargetLaboratoryPageQuery($organizationId: ID!, $projectId: ID!, $targetId: ID!) {
    organizations {
      ...TargetLayout_OrganizationConnectionFragment
    }
    organization(selector: { organization: $organizationId }) {
      organization {
        ...TargetLayout_CurrentOrganizationFragment
        me {
          ...CanAccessTarget_MemberFragment
        }
      }
    }
    project(selector: { organization: $organizationId, project: $projectId }) {
      ...TargetLayout_CurrentProjectFragment
    }
    target(selector: { organization: $organizationId, project: $projectId, target: $targetId }) {
      id
      graphqlEndpointUrl
      latestSchemaVersion {
        id
        sdl
      }
    }
    me {
      ...TargetLayout_MeFragment
    }
    ...TargetLayout_IsCDNEnabledFragment
    ...Laboratory_IsCDNEnabledFragment
  }
`);

function LaboratoryPageContent() {
  const router = useRouteSelector();
  const [query] = useQuery({
    query: TargetLaboratoryPageQuery,
    variables: {
      organizationId: router.organizationId,
      projectId: router.projectId,
      targetId: router.targetId,
    },
  });
  const [isConnectLabModalOpen, toggleConnectLabModal] = useToggle();

  const me = query.data?.me;
  const currentOrganization = query.data?.organization?.organization;
  const currentProject = query.data?.project;
  const organizationConnection = query.data?.organizations;
  const isCDNEnabled = query.data;

  const operationCollectionsPlugin = useOperationCollectionsPlugin({
    canEdit: canAccessTarget(TargetAccessScope.Settings, currentOrganization?.me ?? null),
    canDelete: canAccessTarget(TargetAccessScope.Delete, currentOrganization?.me ?? null),
  });

  const schema = useMemo(() => {
    if (!query.data?.target?.latestSchemaVersion?.sdl) {
      return null;
    }
    return buildSchema(query.data.target.latestSchemaVersion.sdl);
  }, [query.data?.target?.latestSchemaVersion?.sdl]);

  const [actualSelectedApiEndpoint, setEndpointType] = useApiTabValueState(
    query.data?.target?.graphqlEndpointUrl ?? null,
  );

  const mockEndpoint = useMemo(() => {
    if (globalThis.window) {
      return `${location.origin}/api/lab/${router.organizationId}/${router.projectId}/${router.targetId}`;
    }

    return '';
  }, [router.organizationId, router.projectId, router.targetId]);

  const fetcher = useMemo<Fetcher>(() => {
    return async (params, opts) => {
      const fetcher = createGraphiQLFetcher({
        url:
          (actualSelectedApiEndpoint === 'linkedApi'
            ? query.data?.target?.graphqlEndpointUrl
            : undefined) ?? mockEndpoint,
      });

      const result = await fetcher(params, opts);

      // We only want to expose the error message, not the whole stack trace.
      if (isAsyncIterable(result)) {
        return new Repeater(async (push, stop) => {
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          stop.then(
            () => 'return' in result && result.return instanceof Function && result.return(),
          );
          try {
            for await (const value of result) {
              await push(value);
            }
            stop();
          } catch (err: unknown) {
            const error = new Error(err instanceof Error ? err.message : 'Unexpected error.');
            Object.defineProperty(error, 'stack', {
              get() {
                return undefined;
              },
            });
            stop(error);
          }
        });
      }

      return result;
    };
  }, [query.data?.target?.graphqlEndpointUrl, actualSelectedApiEndpoint]);

  if (query.error) {
    return <QueryError error={query.error} />;
  }

  return (
    <TargetLayout
      page={Page.Laboratory}
      currentOrganization={currentOrganization ?? null}
      currentProject={currentProject ?? null}
      me={me ?? null}
      organizations={organizationConnection ?? null}
      isCDNEnabled={isCDNEnabled ?? null}
    >
      <div className="py-6 flex">
        <div className="flex-1">
          <Title>Laboratory</Title>
          <Subtitle>Explore your GraphQL schema and run queries against your GraphQL API.</Subtitle>
          <p>
            <DocsLink className="text-muted-foreground text-sm" href="/features/laboratory">
              Learn more about the Laboratory
            </DocsLink>
          </p>
        </div>
        <div className="ml-auto mr-0 flex flex-col justify-center">
          <div>
            {query.data && !query.data.target?.graphqlEndpointUrl ? (
              <NextLink
                href={{
                  pathname: '/[organizationId]/[projectId]/[targetId]/settings',
                  query: {
                    organizationId: router.organizationId,
                    projectId: router.projectId,
                    targetId: router.targetId,
                  },
                }}
              >
                <Button variant="outline" className="mr-2" size="sm">
                  Connect GraphQL API Endpoint
                </Button>
              </NextLink>
            ) : null}
            <Button onClick={toggleConnectLabModal} variant="ghost" size="sm">
              Mock Data Endpoint
            </Button>
          </div>
          <div className="self-end pt-2">
            <span className="text-xs font-bold mr-2">Query</span>
            <ToggleGroup
              defaultValue="list"
              onValueChange={newValue => {
                setEndpointType(newValue as 'mockApi' | 'linkedApi');
              }}
              value="mock"
              type="single"
              className="bg-gray-900/50 text-gray-500"
            >
              <ToggleGroupItem
                key="mockApi"
                value="mockApi"
                title="Use Mock Schema"
                className={clsx(
                  'hover:text-white text-xs',
                  !query.fetching &&
                    actualSelectedApiEndpoint === 'mockApi' &&
                    'bg-gray-800 text-white',
                )}
                disabled={query.fetching}
              >
                Mock
              </ToggleGroupItem>
              <ToggleGroupItem
                key="linkedApi"
                value="linkedApi"
                title="Use API endpoint"
                className={clsx(
                  'hover:text-white text-xs',
                  !query.fetching &&
                    actualSelectedApiEndpoint === 'linkedApi' &&
                    'bg-gray-800 text-white',
                )}
                disabled={!query.data?.target?.graphqlEndpointUrl || query.fetching}
              >
                API
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>
      </div>
      <style global jsx>{`
        .graphiql-container {
          --color-base: transparent !important;
          --color-primary: 40, 89%, 60% !important;
          min-height: 600px;
        }
        .graphiql-container .graphiql-tab-add {
          display: none;
        }
        .graphiql-container .graphiql-toolbar-icon {
          color: #4c5462;
        }

        .graphiql-container .graphiql-doc-explorer-search {
          background-color: #070d17;
        }
        .graphiql-container .cm-punctuation {
          color: #ccc;
        }
        .graphiql-container .cm-punctuation:hover {
          color: #ffffff;
        }
      `}</style>
      {query.fetching ? null : (
        <GraphiQL
          fetcher={fetcher}
          toolbar={{
            additionalContent: (
              <>
                <Save />
                <Share />
              </>
            ),
          }}
          showPersistHeadersSettings={false}
          shouldPersistHeaders={false}
          plugins={[operationCollectionsPlugin]}
          visiblePlugin={operationCollectionsPlugin}
          schema={schema}
        >
          <GraphiQL.Logo>
            <Tooltip
              content={
                actualSelectedApiEndpoint === 'linkedApi' ? (
                  <>
                    Operations are executed against{' '}
                    <span>{query.data?.target?.graphqlEndpointUrl}</span>.
                  </>
                ) : (
                  <>Operations are executed against the mock endpoint.</>
                )
              }
            >
              <span className="text-xs font-normal pr-2 cursor-help">
                {actualSelectedApiEndpoint === 'linkedApi'
                  ? 'Querying GraphQL API'
                  : 'Querying Mock API'}
              </span>
            </Tooltip>
            <HiveLogo className="h-6 w-auto" />
          </GraphiQL.Logo>
        </GraphiQL>
      )}
      <ConnectLabModal
        endpoint={mockEndpoint}
        close={toggleConnectLabModal}
        isOpen={isConnectLabModalOpen}
        isCDNEnabled={query.data ?? null}
      />
    </TargetLayout>
  );
}

function LaboratoryPage(): ReactElement {
  return (
    <>
      <MetaTitle title="Schema laboratory" />
      <LaboratoryPageContent />
    </>
  );
}

export const getServerSideProps = withSessionProtection();

export default authenticated(LaboratoryPage);

function useApiTabValueState(graphqlEndpointUrl: string | null) {
  const [state, setState] = useResetState<'mockApi' | 'linkedApi'>(() => {
    const value = globalThis.window?.localStorage.getItem('hive:laboratory-tab-value');
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
        globalThis.window?.localStorage.setItem('hive:laboratory-tab-value', state);
        setState(state);
      },
      [setState],
    ),
  ] as const;
}
