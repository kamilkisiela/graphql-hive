import { ReactElement, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import clsx from 'clsx';
import { GraphiQL } from 'graphiql';
import { useMutation, useQuery } from 'urql';
import { authenticated } from '@/components/authenticated-container';
import { TargetLayout } from '@/components/layouts';
import { TargetLayout_OrganizationFragment } from '@/components/layouts/target';
import {
  Accordion,
  Button,
  DocsLink,
  DocsNote,
  EmptyList,
  Heading,
  Link,
  Spinner,
  Title,
} from '@/components/v2';
import { HiveLogo, SaveIcon } from '@/components/v2/icon';
import {
  ConnectLabModal,
  CreateCollectionModal,
  CreateOperationModal,
  DeleteCollectionModal,
  DeleteOperationModal,
} from '@/components/v2/modals';
import { FragmentType, graphql, useFragment } from '@/gql';
import { TargetAccessScope } from '@/gql/graphql';
import { canAccessTarget, CanAccessTarget_MemberFragment } from '@/lib/access/target';
import { useClipboard, useNotifications, useRouteSelector, useToggle } from '@/lib/hooks';
import { useCollections } from '@/lib/hooks/use-collections';
import { withSessionProtection } from '@/lib/supertokens/guard';
import { DropdownMenu, GraphiQLPlugin, Tooltip, useEditorContext } from '@graphiql/react';
import { createGraphiQLFetcher } from '@graphiql/toolkit';
import { BookmarkIcon, DotsVerticalIcon, Link1Icon, Share2Icon } from '@radix-ui/react-icons';
import 'graphiql/graphiql.css';

function Share(): ReactElement {
  const label = 'Share query';
  const copyToClipboard = useClipboard();
  const { href } = window.location;
  const router = useRouter();
  return (
    <Tooltip label={label}>
      <Button
        className="graphiql-toolbar-button"
        aria-label={label}
        disabled={!router.query.operation}
        onClick={async () => {
          await copyToClipboard(href);
        }}
      >
        <Share2Icon className="graphiql-toolbar-icon" />
      </Button>
    </Tooltip>
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

function useOperationCollectionsPlugin(props: {
  meRef: FragmentType<typeof CanAccessTarget_MemberFragment>;
}) {
  const propsRef = useRef(props);
  propsRef.current = props;
  const pluginRef = useRef<GraphiQLPlugin>();
  pluginRef.current ||= {
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

      const canEdit = canAccessTarget(TargetAccessScope.Settings, props.meRef);
      const canDelete = canAccessTarget(TargetAccessScope.Delete, props.meRef);
      const shouldShowMenu = canEdit || canDelete;

      const initialSelectedCollection =
        currentOperation?.id &&
        collections?.find(c => c.operations.nodes.some(node => node.id === currentOperation.id))
          ?.id;

      return (
        <>
          <div className="flex justify-between">
            <Heading>Operation Collections</Heading>
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
          <p className="mb-3 font-light text-gray-300">Shared across your organization</p>
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
                        <DropdownMenu
                          // https://github.com/radix-ui/primitives/issues/1241#issuecomment-1580887090
                          modal={false}
                        >
                          <DropdownMenu.Button
                            className="graphiql-toolbar-button !shrink-0"
                            aria-label="More"
                            data-cy="collection-3-dots"
                          >
                            <DotsVerticalIcon />
                          </DropdownMenu.Button>

                          <DropdownMenu.Content>
                            <DropdownMenu.Item
                              onSelect={() => {
                                setCollectionId(collection.id);
                                toggleCollectionModal();
                              }}
                              data-cy="collection-edit"
                            >
                              Edit
                            </DropdownMenu.Item>
                            <DropdownMenu.Item
                              onSelect={() => {
                                setCollectionId(collection.id);
                                toggleDeleteCollectionModalOpen();
                              }}
                              className="!text-red-500"
                              data-cy="collection-delete"
                            >
                              Delete
                            </DropdownMenu.Item>
                          </DropdownMenu.Content>
                        </DropdownMenu>
                      ) : null}
                    </div>
                    <Accordion.Content className="pr-0">
                      {collection.operations.nodes.length
                        ? collection.operations.nodes.map(node => (
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
                                className={clsx(
                                  'hover:bg-gray-100/10 w-full rounded p-2 !text-gray-300',
                                  router.query.operation === node.id && 'bg-gray-100/10',
                                )}
                              >
                                {node.name}
                              </Link>
                              <DropdownMenu
                                // https://github.com/radix-ui/primitives/issues/1241#issuecomment-1580887090
                                modal={false}
                              >
                                <DropdownMenu.Button
                                  className="graphiql-toolbar-button opacity-0 [div:hover>&]:opacity-100 transition"
                                  aria-label="More"
                                  data-cy="operation-3-dots"
                                >
                                  <DotsVerticalIcon />
                                </DropdownMenu.Button>

                                <DropdownMenu.Content>
                                  <DropdownMenu.Item
                                    onSelect={async () => {
                                      const url = new URL(window.location.href);
                                      await copyToClipboard(
                                        `${url.origin}${url.pathname}?operation=${node.id}`,
                                      );
                                    }}
                                  >
                                    Copy link to operation
                                  </DropdownMenu.Item>
                                  {canDelete ? (
                                    <DropdownMenu.Item
                                      onSelect={() => {
                                        setOperationId(node.id);
                                        toggleDeleteOperationModalOpen();
                                      }}
                                      className="!text-red-500"
                                      data-cy="remove-operation"
                                    >
                                      Delete
                                    </DropdownMenu.Item>
                                  ) : null}
                                </DropdownMenu.Content>
                              </DropdownMenu>
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

  return pluginRef.current;
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
        }
        collection {
          id
          operations {
            nodes {
              id
            }
          }
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
  const isSame = !!currentOperation && currentOperation.query === queryEditor?.getValue();
  const operationId = currentOperation?.id;
  const label = isSame ? undefined : operationId ? 'Update saved operation' : 'Save operation';
  const button = (
    <Button
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
    </Button>
  );

  return (
    <>
      {label ? <Tooltip label={label}>{button}</Tooltip> : button}
      {isOpen ? <CreateOperationModal isOpen={isOpen} toggleModalOpen={toggle} /> : null}
    </>
  );
}

// Save.whyDidYouRender = true;

function Page({
  endpoint,
  organizationRef,
}: {
  endpoint: string;
  organizationRef: FragmentType<typeof TargetLayout_OrganizationFragment>;
}): ReactElement {
  const { me } = useFragment(TargetLayout_OrganizationFragment, organizationRef);
  const operationCollectionsPlugin = useOperationCollectionsPlugin({ meRef: me });
  return (
    <>
      <DocsNote>
        Explore your GraphQL schema and run queries against a mocked version of your GraphQL
        service. <DocsLink href="/features/laboratory">Learn more about the Laboratory</DocsLink>
      </DocsNote>
      <style global jsx>{`
        .graphiql-container {
          --color-base: transparent !important;
          --color-primary: 40, 89%, 60% !important;
          min-height: 600px;
        }
      `}</style>
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
        plugins={[operationCollectionsPlugin]}
        visiblePlugin={operationCollectionsPlugin}
      >
        <GraphiQL.Logo>
          <HiveLogo className="h-6 w-auto" />
        </GraphiQL.Logo>
      </GraphiQL>
    </>
  );
}

const TargetLaboratoryPageQuery = graphql(`
  query TargetLaboratoryPageQuery($organizationId: ID!, $projectId: ID!, $targetId: ID!) {
    organization(selector: { organization: $organizationId }) {
      organization {
        ...TargetLayout_OrganizationFragment
      }
    }
    project(selector: { organization: $organizationId, project: $projectId }) {
      ...TargetLayout_ProjectFragment
    }
    targets(selector: { organization: $organizationId, project: $projectId }) {
      ...TargetLayout_TargetConnectionFragment
    }
    target(selector: { organization: $organizationId, project: $projectId, target: $targetId }) {
      id
    }
    ...TargetLayout_IsCDNEnabledFragment
  }
`);

function LaboratoryPage(): ReactElement {
  const [isModalOpen, toggleModalOpen] = useToggle();
  const router = useRouteSelector();
  const endpoint = `${window.location.origin}/api/lab/${router.organizationId}/${router.projectId}/${router.targetId}`;

  return (
    <>
      <Title title="Schema laboratory" />
      <TargetLayout
        query={TargetLaboratoryPageQuery}
        value="laboratory"
        className="flex h-full flex-col"
        connect={
          <>
            <Button size="large" variant="primary" onClick={toggleModalOpen} className="ml-auto">
              Use Schema Externally
              <Link1Icon className="ml-8 h-6 w-auto" />
            </Button>
            <ConnectLabModal
              isOpen={isModalOpen}
              toggleModalOpen={toggleModalOpen}
              endpoint={endpoint}
            />
          </>
        }
      >
        {({ organization }) => (
          <Page organizationRef={organization!.organization} endpoint={endpoint} />
        )}
      </TargetLayout>
    </>
  );
}

export const getServerSideProps = withSessionProtection();

export default authenticated(LaboratoryPage);
