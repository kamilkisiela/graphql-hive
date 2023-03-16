import { ReactElement, useState } from 'react';
import { GraphiQL } from 'graphiql';
import { authenticated } from '@/components/authenticated-container';
import { TargetLayout } from '@/components/layouts';
import {
  Accordion,
  Button,
  DocsLink,
  DocsNote,
  EmptyList,
  Heading,
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
import { graphql } from '@/gql';
import { useClipboard, useNotifications, useRouteSelector, useToggle } from '@/lib/hooks';
import { useCollections } from '@/lib/hooks/use-collections';
import { withSessionProtection } from '@/lib/supertokens/guard';
import { Menu, ToolbarButton } from '@graphiql/react';
import { createGraphiQLFetcher } from '@graphiql/toolkit';
import { BookmarkIcon, DotsVerticalIcon, Link1Icon } from '@radix-ui/react-icons';
import 'graphiql/graphiql.css';

// function Share(): ReactElement {
//   const { queryEditor, variableEditor, headerEditor } = useEditorContext({
//     nonNull: true,
//   });
//   const copyToClipboard = useClipboard();
//
//   const headers = headerEditor?.getValue();
//   const variables = variableEditor?.getValue();
//   const query = queryEditor?.getValue();
//
//   const label = 'Share query';
//
//   return (
//     <Menu>
//       <Tooltip label={label}>
//         <Menu.Button className="graphiql-toolbar-button" aria-label={label}>
//           <Share2Icon className="graphiql-toolbar-icon" />
//         </Menu.Button>
//       </Tooltip>
//
//       <Menu.List>
//         {['With headers', 'With variables', 'With both'].map((name, i) => (
//           <Menu.Item
//             key={name}
//             onSelect={async () => {
//               const data: { query: string; headers?: string; variables?: string } = { query };
//               if (i === 0 || i === 3) data.headers = headers;
//               if (i === 1 || i === 3) data.variables = variables;
//
//               await copyToClipboard(JSON.stringify(data));
//             }}
//           >
//             {name}
//           </Menu.Item>
//         ))}
//       </Menu.List>
//     </Menu>
//   );
// }

const operationCollectionsPlugin = {
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
    return (
      <>
        <div className="flex justify-between">
          <Heading>Operation Collections</Heading>
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
        </div>
        <p className="mb-3 font-light text-gray-300">Shared across your organization</p>
        {loading ? (
          <Spinner />
        ) : (
          <Accordion>
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

                    <Menu>
                      <Menu.Button className="graphiql-toolbar-button !shrink-0" aria-label="More">
                        <DotsVerticalIcon />
                      </Menu.Button>

                      <Menu.List>
                        <Menu.Item
                          onSelect={() => {
                            setCollectionId(collection.id);
                            toggleCollectionModal();
                          }}
                        >
                          Edit collection
                        </Menu.Item>
                        <Menu.Item
                          onSelect={() => {
                            setCollectionId(collection.id);
                            toggleDeleteCollectionModalOpen();
                          }}
                          className="!text-red-500"
                        >
                          Delete
                        </Menu.Item>
                      </Menu.List>
                    </Menu>
                  </div>
                  <Accordion.Content className="pr-0">
                    {collection.items.edges.length
                      ? collection.items.edges.map(({ node }) => (
                          <div key={node.id} className="flex justify-between items-center">
                            <span>{node.name}</span>
                            <Menu>
                              <Menu.Button className="graphiql-toolbar-button" aria-label="More">
                                <DotsVerticalIcon />
                              </Menu.Button>

                              <Menu.List>
                                <Menu.Item
                                  onSelect={() => {
                                    setOperationId(node.id);
                                    toggleOperationModal();
                                  }}
                                >
                                  Edit operation
                                </Menu.Item>
                                <Menu.Item
                                  onSelect={async () => {
                                    await copyToClipboard(
                                      `${window.location.href}?operation=${node.id}`,
                                    );
                                  }}
                                >
                                  Copy link to operation
                                </Menu.Item>
                                <Menu.Item
                                  onSelect={() => {
                                    setOperationId(node.id);
                                    toggleDeleteOperationModalOpen();
                                  }}
                                  className="!text-red-500"
                                >
                                  Delete
                                </Menu.Item>
                              </Menu.List>
                            </Menu>
                          </div>
                        ))
                      : 'No operations'}
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

function Save(): ReactElement {
  const [isOpen, toggle] = useToggle();
  const { collections } = useCollections();
  const notify = useNotifications();
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
      <CreateOperationModal isOpen={isOpen} toggleModalOpen={toggle} />
    </>
  );
}

function Page({ endpoint }: { endpoint: string }): ReactElement {
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
      `}</style>
      <GraphiQL
        fetcher={createGraphiQLFetcher({ url: endpoint })}
        toolbar={{
          additionalContent: (
            <>
              {/*<Share />*/}
              <Save />
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
        {() => <Page endpoint={endpoint} />}
      </TargetLayout>
    </>
  );
}

export const getServerSideProps = withSessionProtection();

export default authenticated(LaboratoryPage);
