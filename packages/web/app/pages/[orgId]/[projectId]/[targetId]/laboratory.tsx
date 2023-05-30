import { ReactElement, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import clsx from 'clsx';
import { GraphiQL } from 'graphiql';
import { useQuery } from 'urql';
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
import { OperationDocument } from '@/graphql';
import { canAccessTarget, CanAccessTarget_MemberFragment } from '@/lib/access/target';
import { useClipboard, useNotifications, useRouteSelector, useToggle } from '@/lib/hooks';
import { useCollections } from '@/lib/hooks/use-collections';
import { withSessionProtection } from '@/lib/supertokens/guard';
import { GraphiQLPlugin, Menu, ToolbarButton, Tooltip, useEditorContext } from '@graphiql/react';
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

function hashFromTabContents(args: {
  query: string | null;
  variables?: string | null;
  headers?: string | null;
}): string {
  return [args.query ?? '', args.variables ?? '', args.headers ?? ''].join('|');
}

function useOperation(operationId: string) {
  const router = useRouteSelector();
  const [{ data }] = useQuery({
    query: OperationDocument,
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
  const editorContext = useEditorContext({ nonNull: true });

  const hasAllEditors = !!(
    editorContext.queryEditor &&
    editorContext.variableEditor &&
    editorContext.headerEditor
  );

  useEffect(() => {
    const operation = data?.target?.documentCollectionOperation;
    if (hasAllEditors && operationId && operation) {
      if (editorContext.tabs.length !== 1) {
        for (const [index] of editorContext.tabs.entries()) {
          editorContext.closeTab(index);
        }
      }
      editorContext.queryEditor.setValue(operation.query);
      editorContext.variableEditor.setValue(operation.variables);
      editorContext.headerEditor.setValue(operation.headers);
    }
  }, [hasAllEditors, operationId, data?.target?.documentCollectionOperation.id]);
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
      const [isOperationModalOpen, toggleOperationModal] = useToggle();
      const { collections, loading } = useCollections();
      const [operationId, setOperationId] = useState('');
      const [collectionId, setCollectionId] = useState('');
      const [isDeleteCollectionModalOpen, toggleDeleteCollectionModalOpen] = useToggle();
      const [isDeleteOperationModalOpen, toggleDeleteOperationModalOpen] = useToggle();
      const copyToClipboard = useClipboard();
      const router = useRouteSelector();
      const operation = router.query.operation as string;
      useOperation(operation);

      const canEdit = canAccessTarget(TargetAccessScope.Settings, props.meRef);
      const canDelete = canAccessTarget(TargetAccessScope.Delete, props.meRef);
      const shouldShowMenu = canEdit || canDelete;

      const initialSelectedCollection =
        operation &&
        collections?.find(c => c.operations.nodes.some(node => node.id === operation))?.id;
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
              <CreateOperationModal
                isOpen={isOperationModalOpen}
                toggleModalOpen={toggleOperationModal}
                operationId={operationId}
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
                        <Menu>
                          <Menu.Button
                            className="graphiql-toolbar-button !shrink-0"
                            aria-label="More"
                            data-cy="collection-3-dots"
                          >
                            <DotsVerticalIcon />
                          </Menu.Button>

                          <Menu.List>
                            <Menu.Item
                              onSelect={() => {
                                setCollectionId(collection.id);
                                toggleCollectionModal();
                              }}
                              data-cy="collection-edit"
                            >
                              Edit
                            </Menu.Item>
                            <Menu.Item
                              onSelect={() => {
                                setCollectionId(collection.id);
                                toggleDeleteCollectionModalOpen();
                              }}
                              className="!text-red-500"
                              data-cy="collection-delete"
                            >
                              Delete
                            </Menu.Item>
                          </Menu.List>
                        </Menu>
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
                              <Menu>
                                <Menu.Button
                                  className="graphiql-toolbar-button opacity-0 [div:hover>&]:opacity-100 transition"
                                  aria-label="More"
                                  data-cy="operation-3-dots"
                                >
                                  <DotsVerticalIcon />
                                </Menu.Button>

                                <Menu.List>
                                  {canEdit ? (
                                    <Menu.Item
                                      onSelect={() => {
                                        setOperationId(node.id);
                                        toggleOperationModal();
                                      }}
                                      data-cy="edit-operation"
                                    >
                                      Edit operation
                                    </Menu.Item>
                                  ) : null}
                                  <Menu.Item
                                    onSelect={async () => {
                                      const url = new URL(window.location.href);
                                      await copyToClipboard(
                                        `${url.origin}${url.pathname}?operation=${node.id}`,
                                      );
                                    }}
                                  >
                                    Copy link to operation
                                  </Menu.Item>
                                  {canDelete ? (
                                    <Menu.Item
                                      onSelect={() => {
                                        setOperationId(node.id);
                                        toggleDeleteOperationModalOpen();
                                      }}
                                      className="!text-red-500"
                                      data-cy="remove-operation"
                                    >
                                      Delete
                                    </Menu.Item>
                                  ) : null}
                                </Menu.List>
                              </Menu>
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

function Save(): ReactElement {
  const [isOpen, toggle] = useToggle();
  const { collections } = useCollections();
  const notify = useNotifications();
  const { query } = useRouter();
  return (
    <>
      <ToolbarButton
        onClick={() => {
          if (collections?.length) {
            toggle();
          } else {
            notify('You must create collection first!', 'warning');
          }
        }}
        label="Save operation"
        data-cy="save-collection"
      >
        <SaveIcon className="graphiql-toolbar-icon !h-5 w-auto" />
      </ToolbarButton>
      {isOpen ? (
        <CreateOperationModal
          isOpen={isOpen}
          toggleModalOpen={toggle}
          operationId={query.operation as string}
        />
      ) : null}
    </>
  );
}

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
        }
        .graphiql-tab-add {
          display: none !important;
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
