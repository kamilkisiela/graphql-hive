import { ReactElement, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { GraphiQL } from 'graphiql';
import { LinkIcon } from 'lucide-react';
import { useMutation, useQuery } from 'urql';
import { authenticated } from '@/components/authenticated-container';
import { TargetLayout } from '@/components/layouts/target';
import { Button } from '@/components/ui/button';
import { Accordion, DocsLink, EmptyList, Link, Spinner, Title } from '@/components/v2';
import { HiveLogo, SaveIcon } from '@/components/v2/icon';
import {
  CreateCollectionModal,
  CreateOperationModal,
  DeleteCollectionModal,
  DeleteOperationModal,
} from '@/components/v2/modals';
import { ConnectLabModal } from '@/components/v2/modals/connect-lab';
import { graphql } from '@/gql';
import { TargetAccessScope } from '@/gql/graphql';
import { canAccessTarget } from '@/lib/access/target';
import {
  useClipboard,
  useCollections,
  useNotifications,
  useRouteSelector,
  useToggle,
} from '@/lib/hooks';
import { useNotFoundRedirectOnError } from '@/lib/hooks/use-not-found-redirect-on-error';
import { withSessionProtection } from '@/lib/supertokens/guard';
import { cn } from '@/lib/utils';
import {
  Button as GraphiQLButton,
  DropdownMenu as GraphiQLDropdownMenu,
  GraphiQLPlugin,
  Tooltip as GraphiQLTooltip,
  useEditorContext,
} from '@graphiql/react';
import { createGraphiQLFetcher } from '@graphiql/toolkit';
import { BookmarkIcon, DotsVerticalIcon, Share2Icon } from '@radix-ui/react-icons';
import 'graphiql/graphiql.css';

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
        <Share2Icon className="graphiql-toolbar-icon" />
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
    content: function Content() {
      const [isCollectionModalOpen, toggleCollectionModal] = useToggle();
      const { collections, loading } = useCollections();
      const [collectionId, setCollectionId] = useState('');
      const [operationId, setOperationId] = useState('');
      const [isDeleteCollectionModalOpen, toggleDeleteCollectionModalOpen] = useToggle();
      const [isDeleteOperationModalOpen, toggleDeleteOperationModalOpen] = useToggle();
      const copyToClipboard = useClipboard();
      const router = useRouteSelector();

      const currentOperation = useCurrentOperation();
      const editorContext = useEditorContext({ nonNull: true });

      const hasAllEditors = !!(
        editorContext.queryEditor &&
        editorContext.variableEditor &&
        editorContext.headerEditor
      );

      const queryParamsOperationId = router.query.operation as string;

      const tabsCount = editorContext.tabs.length;

      useEffect(() => {
        if (tabsCount !== 1) {
          for (let index = 1; index < tabsCount; index++) {
            // Workaround to close opened tabs from end, to avoid bug when tabs are still opened
            editorContext.closeTab(tabsCount - index);
          }
          const { operation: _paramToRemove, ...query } = router.query;
          void router.push({ query });
        }
      }, [tabsCount]);

      useEffect(() => {
        if (!hasAllEditors) return;

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
        <>
          <div className="flex justify-between">
            <h3 className="text-lg font-semibold tracking-tight">Collections</h3>
            {canEdit ? (
              <Button
                variant="link"
                onClick={() => {
                  if (collectionId) setCollectionId('');
                  toggleCollectionModal();
                }}
                data-cy="create-collection"
              >
                + Create
              </Button>
            ) : null}
          </div>
          <p className="mb-3 font-light text-gray-300 text-xs">Shared across your organization</p>
          {loading ? (
            <Spinner />
          ) : (
            <Accordion defaultValue={initialSelectedCollection}>
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
              <DeleteOperationModal
                isOpen={isDeleteOperationModalOpen}
                toggleModalOpen={toggleDeleteOperationModalOpen}
                operationId={operationId}
              />
              {collections?.length ? (
                collections.map(collection => (
                  <Accordion.Item key={collection.id} value={collection.id}>
                    <div className="flex">
                      <Accordion.Header>{collection.name}</Accordion.Header>

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
                            <div key={node.id} className="flex justify-between items-center">
                              <Link
                                href={{
                                  query: {
                                    operation: node.id,
                                    orgId: router.organizationId,
                                    projectId: router.projectId,
                                    targetId: router.targetId,
                                  },
                                }}
                                className={cn(
                                  'hover:bg-gray-100/10 w-full rounded p-2 !text-gray-300',
                                  router.query.operation === node.id && 'bg-gray-100/10',
                                )}
                                onClick={ev => {
                                  ev.preventDefault();
                                  void router.push(
                                    {
                                      query: {
                                        operation: node.id,
                                        orgId: router.organizationId,
                                        projectId: router.projectId,
                                        targetId: router.targetId,
                                      },
                                    },
                                    undefined,
                                    {
                                      scroll: false,
                                    },
                                  );
                                }}
                              >
                                {node.name}
                              </Link>
                              <GraphiQLDropdownMenu
                                // https://github.com/radix-ui/primitives/issues/1241#issuecomment-1580887090
                                modal={false}
                              >
                                <GraphiQLDropdownMenu.Button
                                  className="graphiql-toolbar-button opacity-0 [div:hover>&]:opacity-100 transition"
                                  aria-label="More"
                                  data-cy="operation-3-dots"
                                >
                                  <DotsVerticalIcon />
                                </GraphiQLDropdownMenu.Button>

                                <GraphiQLDropdownMenu.Content>
                                  <GraphiQLDropdownMenu.Item
                                    onSelect={async () => {
                                      const url = new URL(window.location.href);
                                      await copyToClipboard(
                                        `${url.origin}${url.pathname}?operation=${node.id}`,
                                      );
                                    }}
                                  >
                                    Copy link to operation
                                  </GraphiQLDropdownMenu.Item>
                                  {canDelete ? (
                                    <GraphiQLDropdownMenu.Item
                                      onSelect={() => {
                                        setOperationId(node.id);
                                        toggleDeleteOperationModalOpen();
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
                          ))
                        : 'No operations yet. Use the editor to create an operation, and click Save to store and share it.'}
                    </Accordion.Content>
                  </Accordion.Item>
                ))
              ) : (
                <EmptyList
                  title="Add your first collection"
                  description="Collections shared across organization"
                />
              )}
            </Accordion>
          )}
        </>
      );
    },
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
  const operationId = currentOperation?.id;
  const label = isSame ? undefined : operationId ? 'Update saved operation' : 'Save operation';
  const button = (
    <GraphiQLButton
      className="graphiql-toolbar-button"
      data-cy="save-collection"
      aria-label={label}
      disabled={isSame}
      onClick={async () => {
        if (!collections?.length) {
          notify('You must create collection first!', 'warning');
          return;
        }
        if (!operationId) {
          toggle();
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
            operationId,
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
      <SaveIcon className="graphiql-toolbar-icon !h-5 w-auto" />
    </GraphiQLButton>
  );

  return (
    <>
      {label ? <GraphiQLTooltip label={label}>{button}</GraphiQLTooltip> : button}
      {isOpen ? <CreateOperationModal isOpen={isOpen} toggleModalOpen={toggle} /> : null}
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
    }
    me {
      ...TargetLayout_MeFragment
    }
    ...TargetLayout_IsCDNEnabledFragment
  }
`);

function LaboratoryPageContent() {
  const [isModalOpen, toggleModalOpen] = useToggle();
  const router = useRouteSelector();
  const [query] = useQuery({
    query: TargetLaboratoryPageQuery,
    variables: {
      organizationId: router.organizationId,
      projectId: router.projectId,
      targetId: router.targetId,
    },
  });
  useNotFoundRedirectOnError(!!query.error);

  const endpoint = `${location.origin}/api/lab/${router.organizationId}/${router.projectId}/${router.targetId}`;
  const me = query.data?.me;
  const currentOrganization = query.data?.organization?.organization;
  const currentProject = query.data?.project;
  const organizationConnection = query.data?.organizations;
  const isCDNEnabled = query.data;

  const operationCollectionsPlugin = useOperationCollectionsPlugin({
    canEdit: canAccessTarget(TargetAccessScope.Settings, currentOrganization?.me ?? null),
    canDelete: canAccessTarget(TargetAccessScope.Delete, currentOrganization?.me ?? null),
  });

  if (query.error) {
    return null;
  }

  return (
    <TargetLayout
      value="laboratory"
      className="flex justify-between gap-8"
      currentOrganization={currentOrganization ?? null}
      currentProject={currentProject ?? null}
      me={me ?? null}
      organizations={organizationConnection ?? null}
      isCDNEnabled={isCDNEnabled ?? null}
      connect={
        <div>
          <Button onClick={toggleModalOpen} variant="link" className="text-orange-500">
            <LinkIcon size={16} className="mr-2" />
            Use Schema Externally
          </Button>
          <ConnectLabModal
            isOpen={isModalOpen}
            toggleModalOpen={toggleModalOpen}
            endpoint={endpoint}
          />
        </div>
      }
    >
      <div className="grow">
        <div className="py-6">
          <h3 className="text-lg font-semibold tracking-tight">Laboratory</h3>
          <p className="text-sm text-gray-400">
            Explore your GraphQL schema and run queries against a mocked version of your GraphQL
            service.
          </p>
          <p>
            <DocsLink className="text-muted-foreground text-sm" href="/features/laboratory">
              Learn more about the Laboratory
            </DocsLink>
          </p>
        </div>
        <style global jsx>{`
          .graphiql-container {
            --color-base: transparent !important;
            --color-primary: 40, 89%, 60% !important;
            min-height: 600px;
          }
        `}</style>
        {query.fetching ? null : (
          <GraphiQL
            fetcher={createGraphiQLFetcher({ url: endpoint })}
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
          >
            <GraphiQL.Logo>
              <HiveLogo className="h-6 w-auto" />
            </GraphiQL.Logo>
          </GraphiQL>
        )}
      </div>
    </TargetLayout>
  );
}

function LaboratoryPage(): ReactElement {
  return (
    <>
      <Title title="Schema laboratory" />
      <LaboratoryPageContent />
    </>
  );
}

export const getServerSideProps = withSessionProtection();

export default authenticated(LaboratoryPage);
