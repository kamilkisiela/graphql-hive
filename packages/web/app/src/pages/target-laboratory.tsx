import { ReactElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cx } from 'class-variance-authority';
import clsx from 'clsx';
import { GraphiQL } from 'graphiql';
import { buildSchema } from 'graphql';
import { FolderIcon, FolderOpenIcon, SquareTerminalIcon } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import { useMutation, useQuery } from 'urql';
import { Page, TargetLayout } from '@/components/layouts/target';
import { ConnectLabModal } from '@/components/target/laboratory/connect-lab-modal';
import { CreateCollectionModal } from '@/components/target/laboratory/create-collection-modal';
import { CreateOperationModal } from '@/components/target/laboratory/create-operation-modal';
import { DeleteCollectionModal } from '@/components/target/laboratory/delete-collection-modal';
import { DeleteOperationModal } from '@/components/target/laboratory/delete-operation-modal';
import { EditOperationModal } from '@/components/target/laboratory/edit-operation-modal';
import {
  Accordion,
  AccordionContent,
  AccordionHeader,
  AccordionItem,
  AccordionTriggerPrimitive,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { DocsLink } from '@/components/ui/docs-note';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Link } from '@/components/ui/link';
import { Meta } from '@/components/ui/meta';
import { Subtitle, Title } from '@/components/ui/page';
import { QueryError } from '@/components/ui/query-error';
import { Spinner } from '@/components/ui/spinner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { PlusIcon, SaveIcon, ShareIcon } from '@/components/v2/icon';
import { ToggleGroup, ToggleGroupItem } from '@/components/v2/toggle-group';
import { graphql } from '@/gql';
import { TargetAccessScope } from '@/gql/graphql';
import { canAccessTarget } from '@/lib/access/target';
import { useClipboard, useNotifications, useToggle } from '@/lib/hooks';
import { useResetState } from '@/lib/hooks/use-reset-state';
import { cn } from '@/lib/utils';
import {
  UnStyledButton as GraphiQLButton,
  GraphiQLPlugin,
  Tooltip as GraphiQLTooltip,
  useEditorContext,
} from '@graphiql/react';
import { createGraphiQLFetcher, Fetcher, isAsyncIterable } from '@graphiql/toolkit';
import {
  BookmarkIcon,
  DotsHorizontalIcon,
  EnterFullScreenIcon,
  ExitFullScreenIcon,
} from '@radix-ui/react-icons';
import { Repeater } from '@repeaterjs/repeater';
import { Link as RouterLink, useRouter } from '@tanstack/react-router';
import 'graphiql/graphiql.css';

function Share({ operation }: { operation: string | null }): ReactElement | null {
  const label = 'Share query';
  const copyToClipboard = useClipboard();

  if (!operation) return null;

  return (
    <GraphiQLTooltip label={label}>
      <GraphiQLButton
        className="graphiql-toolbar-button"
        aria-label={label}
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
        updatedAt
        collection {
          id
          name
        }
      }
    }
  }
`);

function useCurrentOperation(props: {
  organizationId: string;
  projectId: string;
  targetId: string;
}) {
  const router = useRouter();
  const operationIdFromSearch =
    'operation' in router.latestLocation.search &&
    typeof router.latestLocation.search.operation === 'string'
      ? router.latestLocation.search.operation
      : null;
  const [{ data }] = useQuery({
    query: OperationQuery,
    variables: {
      selector: {
        target: props.targetId,
        project: props.projectId,
        organization: props.organizationId,
      },
      id: operationIdFromSearch!,
    },
    pause: !operationIdFromSearch,
  });
  // if operationId is undefined `data` could contain previous state
  return operationIdFromSearch ? data?.target?.documentCollectionOperation : null;
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
  isChanged?: boolean;
  organizationId: string;
  projectId: string;
  targetId: string;
}): ReactElement => {
  const router = useRouter();
  const operationIdFromSearch =
    'operation' in router.latestLocation.search &&
    typeof router.latestLocation.search.operation === 'string'
      ? router.latestLocation.search.operation
      : null;
  const copyToClipboard = useClipboard();

  return (
    <div key={props.node.id} className="flex items-center justify-between">
      <Link
        to="/$organizationId/$projectId/$targetId/laboratory"
        params={{
          organizationId: props.organizationId,
          projectId: props.projectId,
          targetId: props.targetId,
        }}
        search={{
          operation: props.node.id,
        }}
        className={cn(
          'flex w-full items-center justify-between rounded p-2 font-normal text-white/50 hover:bg-gray-100/10 hover:text-white',
          operationIdFromSearch === props.node.id && 'bg-gray-100/10 text-white',
        )}
      >
        <div className="flex items-center gap-x-3">
          <SquareTerminalIcon className="size-4" />
          {props.node.name}
        </div>
        {props.isChanged && (
          <span className="size-1.5 rounded-full border border-orange-600 bg-orange-400" />
        )}
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger className="graphiql-toolbar-button text-white opacity-0 transition-opacity [div:hover>&]:opacity-100">
          <DotsHorizontalIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={async () => {
              const url = new URL(window.location.href);
              await copyToClipboard(`${url.origin}${url.pathname}?operation=${props.node.id}`);
            }}
          >
            Copy link to operation
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {props.canEdit && (
            <DropdownMenuItem
              onClick={() => {
                props.onEdit(props.node.id);
              }}
            >
              Edit
            </DropdownMenuItem>
          )}
          {props.canDelete && (
            <DropdownMenuItem
              onClick={() => {
                props.onDelete(props.node.id);
              }}
              className="text-red-500"
            >
              Delete
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
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
            description
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

export function useCollections(props: {
  organizationId: string;
  projectId: string;
  targetId: string;
}) {
  const [{ data, error, fetching }] = useQuery({
    query: CollectionsQuery,
    variables: {
      selector: {
        target: props.targetId,
        organization: props.organizationId,
        project: props.projectId,
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

function useOperationCollectionsPlugin(props: {
  canEdit: boolean;
  canDelete: boolean;
  organizationId: string;
  projectId: string;
  targetId: string;
}): GraphiQLPlugin {
  return useMemo(() => {
    function Content() {
      const [isCollectionModalOpen, toggleCollectionModal] = useToggle();
      const { collections, fetching: loading } = useCollections({
        organizationId: props.organizationId,
        projectId: props.projectId,
        targetId: props.targetId,
      });
      const [collectionId, setCollectionId] = useState('');
      const [isDeleteCollectionModalOpen, toggleDeleteCollectionModalOpen] = useToggle();
      const [operationToDeleteId, setOperationToDeleteId] = useState<null | string>(null);
      const [operationToEditId, setOperationToEditId] = useState<null | string>(null);
      const { clearOperation, savedOperation, setSavedOperation } = useSyncOperationState({
        organizationId: props.organizationId,
        projectId: props.projectId,
        targetId: props.targetId,
      });
      const router = useRouter();
      const [accordionValue, setAccordionValue] = useState<string[]>([]);
      const containerRef = useRef<HTMLDivElement>(null);
      const [isScrolled, setIsScrolled] = useState(false);

      const currentOperation = useCurrentOperation({
        organizationId: props.organizationId,
        projectId: props.projectId,
        targetId: props.targetId,
      });
      const editorContext = useEditorContext({ nonNull: true });

      const hasAllEditors = !!(
        editorContext.queryEditor &&
        editorContext.variableEditor &&
        editorContext.headerEditor
      );

      const isSame =
        !!currentOperation &&
        currentOperation.query === editorContext.queryEditor?.getValue() &&
        currentOperation.variables === editorContext.variableEditor?.getValue() &&
        currentOperation.headers === editorContext.headerEditor?.getValue();

      const queryParamsOperationId =
        'operation' in router.latestLocation.search &&
        typeof router.latestLocation.search.operation === 'string'
          ? router.latestLocation.search.operation
          : null;

      useEffect(() => {
        if (!hasAllEditors || !currentOperation) {
          return;
        }

        if (queryParamsOperationId) {
          // Set selected operation in editors
          editorContext.queryEditor?.setValue(currentOperation.query);
          editorContext.variableEditor?.setValue(currentOperation.variables ?? '');
          editorContext.headerEditor?.setValue(currentOperation.headers ?? '');

          if (!savedOperation) {
            return;
          }

          const oneWeek = 7 * 24 * 60 * 60 * 1000;
          if (savedOperation.updatedAt + oneWeek < Date.now()) {
            clearOperation();
            return;
          }

          const currentOperationUpdatedAt = new Date(currentOperation.updatedAt).getTime();
          if (savedOperation.updatedAt > currentOperationUpdatedAt) {
            editorContext.queryEditor?.setValue(savedOperation.query);
            editorContext.variableEditor?.setValue(savedOperation.variables);
          }
        }
      }, [hasAllEditors, queryParamsOperationId, currentOperation]);

      useEffect(() => {
        if (!hasAllEditors || !currentOperation || isSame) {
          return;
        }
        setSavedOperation({
          query: editorContext.queryEditor?.getValue() ?? '',
          variables: editorContext.variableEditor?.getValue() ?? '',
        });
      }, [editorContext.queryEditor?.getValue(), editorContext.variableEditor?.getValue()]);

      const shouldShowMenu = props.canEdit || props.canDelete;

      const initialSelectedCollection =
        currentOperation?.id &&
        collections?.find(c =>
          c.operations.edges.some(({ node }) => node.id === currentOperation.id),
        )?.id;

      const [createOperationState, createOperation] = useMutation(CreateOperationMutation);
      const notify = useNotifications();

      const addOperation = async (e: { currentTarget: { dataset: DOMStringMap } }) => {
        const collectionId = e.currentTarget.dataset.collectionId!;

        const result = await createOperation({
          input: {
            collectionId,
            name: 'New Operation',
            query: '{\n  \n}',
            headers: '',
            variables: '',
          },
          selector: {
            target: props.targetId,
            organization: props.organizationId,
            project: props.projectId,
          },
        });
        if (result.error) {
          notify("Couldn't create operation. Please try again later.", 'error');
        }
        if (result.data?.createOperationInDocumentCollection.error) {
          notify(result.data.createOperationInDocumentCollection.error.message, 'error');
        }
        if (result.data?.createOperationInDocumentCollection.ok) {
          void router.navigate({
            to: '/$organizationId/$projectId/$targetId/laboratory',
            params: {
              organizationId: props.organizationId,
              projectId: props.projectId,
              targetId: props.targetId,
            },
            search: {
              operation: result.data.createOperationInDocumentCollection.ok.operation.id,
            },
          });
        }
      };

      useEffect(() => {
        if (!initialSelectedCollection || isScrolled) return;

        setAccordionValue([initialSelectedCollection]);
        setTimeout(() => {
          const link = containerRef.current!.querySelector(`a[href$="${queryParamsOperationId}"]`);
          link!.scrollIntoView();
          setIsScrolled(true);
        }, 150);
      }, [initialSelectedCollection]);

      return (
        <>
          <div className="mb-5 flex justify-between gap-1">
            <Title>Operations</Title>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="orangeLink"
                    size="icon-sm"
                    className={clsx(
                      'flex w-auto items-center gap-1',
                      'min-w-0', // trick to make work truncate
                    )}
                    onClick={() => {
                      if (collectionId) {
                        setCollectionId('');
                      }
                      toggleCollectionModal();
                    }}
                  >
                    <PlusIcon className="size-4 shrink-0" />
                    <span className="truncate">New collection</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Create a new collection of GraphQL Operations</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          {loading ? (
            <div className="flex flex-col items-center gap-4 text-xs">
              <Spinner />
              Loading collections...
            </div>
          ) : collections?.length ? (
            <Accordion
              ref={containerRef}
              value={accordionValue}
              onValueChange={setAccordionValue}
              type="multiple"
            >
              {collections.map(collection => (
                <AccordionItem key={collection.id} value={collection.id} className="border-b-0">
                  <AccordionHeader className="flex items-center justify-between">
                    <AccordionTriggerPrimitive className="group flex w-full items-center gap-x-3 rounded p-2 font-medium text-white hover:bg-gray-100/10">
                      <FolderIcon className="group-radix-state-open:hidden size-4" />
                      <FolderOpenIcon className="group-radix-state-closed:hidden size-4" />
                      {collection.name}
                    </AccordionTriggerPrimitive>
                    {shouldShowMenu ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger aria-label="More" className="graphiql-toolbar-button">
                          <DotsHorizontalIcon />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={addOperation}
                            disabled={createOperationState.fetching}
                            data-collection-id={collection.id}
                          >
                            Add operation <PlusIcon className="ml-2 size-4" />
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => {
                              setCollectionId(collection.id);
                              toggleCollectionModal();
                            }}
                          >
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setCollectionId(collection.id);
                              toggleDeleteCollectionModalOpen();
                            }}
                            className="text-red-500"
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null}
                  </AccordionHeader>
                  <AccordionContent className="space-y-0 pb-2 pl-2">
                    {collection.operations.edges.length ? (
                      collection.operations.edges.map(({ node }) => (
                        <CollectionItem
                          key={node.id}
                          node={node}
                          canDelete={props.canDelete}
                          canEdit={props.canEdit}
                          onDelete={setOperationToDeleteId}
                          onEdit={setOperationToEditId}
                          isChanged={!isSame && node.id === queryParamsOperationId}
                          organizationId={props.organizationId}
                          projectId={props.projectId}
                          targetId={props.targetId}
                        />
                      ))
                    ) : (
                      <Button
                        variant="orangeLink"
                        className="mx-auto block"
                        onClick={addOperation}
                        data-collection-id={collection.id}
                      >
                        <PlusIcon className="mr-1 inline size-4" /> Add Operation
                      </Button>
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          ) : (
            <div className="flex h-fit flex-1 items-center justify-center">
              <div className="flex flex-col items-center">
                <BookmarkIcon width={30} height={30} />
                <div className="mt-2 text-xs">There are no collections available.</div>
                {props.canEdit ? (
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
            organizationId={props.organizationId}
            projectId={props.projectId}
            targetId={props.targetId}
            isOpen={isCollectionModalOpen}
            toggleModalOpen={toggleCollectionModal}
            collectionId={collectionId}
          />
          <DeleteCollectionModal
            organizationId={props.organizationId}
            projectId={props.projectId}
            targetId={props.targetId}
            isOpen={isDeleteCollectionModalOpen}
            toggleModalOpen={toggleDeleteCollectionModalOpen}
            collectionId={collectionId}
          />
          {operationToDeleteId && (
            <DeleteOperationModal
              organizationId={props.organizationId}
              projectId={props.projectId}
              targetId={props.targetId}
              close={() => setOperationToDeleteId(null)}
              operationId={operationToDeleteId}
            />
          )}
          {operationToEditId && (
            <EditOperationModal
              organizationId={props.organizationId}
              projectId={props.projectId}
              targetId={props.targetId}
              operationId={operationToEditId}
              close={() => setOperationToEditId(null)}
            />
          )}
        </>
      );
    }

    return {
      title: 'Operation Collections',
      icon: BookmarkIcon,
      content: Content,
    };
  }, [props.canEdit, props.canDelete]);
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

function useSyncOperationState(props: {
  organizationId: string;
  projectId: string;
  targetId: string;
}): {
  savedOperation: { query: string; variables: string; updatedAt: number } | null;
  setSavedOperation: (value: { query: string; variables: string }) => void;
  clearOperation: () => void;
} {
  const currentOperation = useCurrentOperation({
    organizationId: props.organizationId,
    projectId: props.projectId,
    targetId: props.targetId,
  });
  const storageKey = currentOperation ? `hive:operation-${currentOperation?.id}` : null;
  const savedOperationData = storageKey ? localStorage.getItem(storageKey) : null;
  const operation = savedOperationData ? JSON.parse(savedOperationData) : null;

  const setSavedOperation = (value: { query: string; variables: string }) => {
    if (!storageKey) {
      return;
    }
    localStorage.setItem(storageKey, JSON.stringify({ ...value, updatedAt: Date.now() }));
  };

  const clearOperation = () => {
    if (!storageKey) {
      return;
    }
    localStorage.removeItem(storageKey);
  };

  return {
    savedOperation: operation,
    setSavedOperation,
    clearOperation,
  };
}

function Save(props: {
  organizationId: string;
  projectId: string;
  targetId: string;
}): ReactElement {
  const router = useRouter();
  const [operationModalOpen, toggleOperationModal] = useToggle();
  const { collections } = useCollections({
    organizationId: props.organizationId,
    projectId: props.projectId,
    targetId: props.targetId,
  });
  const notify = useNotifications();
  const currentOperation = useCurrentOperation({
    organizationId: props.organizationId,
    projectId: props.projectId,
    targetId: props.targetId,
  });
  const [, mutateUpdate] = useMutation(UpdateOperationMutation);
  const { queryEditor, variableEditor, headerEditor } = useEditorContext()!;
  const { clearOperation } = useSyncOperationState({
    organizationId: props.organizationId,
    projectId: props.projectId,
    targetId: props.targetId,
  });
  const onSaveSuccess = useCallback(
    (operationId?: string) => {
      if (operationId) {
        void router.navigate({
          to: '/$organizationId/$projectId/$targetId/laboratory',
          params: {
            organizationId: props.organizationId,
            projectId: props.projectId,
            targetId: props.targetId,
          },
          search: {
            operation: operationId,
          },
        });
      }
      clearOperation();
    },
    [clearOperation, router],
  );
  const isSame =
    !!currentOperation &&
    currentOperation.query === queryEditor?.getValue() &&
    currentOperation.variables === variableEditor?.getValue() &&
    currentOperation.headers === headerEditor?.getValue();

  const label = 'Save operation';

  return (
    <DropdownMenu>
      <GraphiQLTooltip label={label}>
        <DropdownMenuTrigger asChild>
          <GraphiQLButton className="graphiql-toolbar-button relative" aria-label={label}>
            {!isSame && (
              <span className="absolute right-1 top-1 size-1.5 rounded-full border border-orange-600 bg-orange-400" />
            )}
            <SaveIcon className="graphiql-toolbar-icon h-5" />
          </GraphiQLButton>
        </DropdownMenuTrigger>
      </GraphiQLTooltip>
      <DropdownMenuContent align="end">
        {!isSame && currentOperation && (
          <>
            <DropdownMenuItem
              disabled={isSame || !currentOperation}
              className="mb-0 text-red-600"
              onClick={async () => {
                queryEditor?.setValue(currentOperation.query);
                clearOperation();
              }}
            >
              Discard changes
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem
          disabled={isSame || !currentOperation}
          className={cx(
            (isSame || !currentOperation) && 'cursor-default text-gray-400 hover:bg-transparent',
          )}
          onClick={async () => {
            if (!currentOperation || isSame) {
              return;
            }
            const { error, data } = await mutateUpdate({
              selector: {
                target: props.targetId,
                organization: props.organizationId,
                project: props.projectId,
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
              clearOperation();
              notify('Updated!', 'success');
            }
            if (error) {
              notify(error.message, 'error');
            }
          }}
        >
          Save
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={async () => {
            if (!collections.length) {
              notify('Please create a collection first.', 'error');
              return;
            }
            toggleOperationModal();
          }}
        >
          Save as
        </DropdownMenuItem>
      </DropdownMenuContent>
      <CreateOperationModal
        organizationId={props.organizationId}
        projectId={props.projectId}
        targetId={props.targetId}
        isOpen={operationModalOpen}
        close={toggleOperationModal}
        onSaveSuccess={onSaveSuccess}
      />
    </DropdownMenu>
  );
}

const TargetLaboratoryPageQuery = graphql(`
  query TargetLaboratoryPageQuery($organizationId: ID!, $projectId: ID!, $targetId: ID!) {
    organization(selector: { organization: $organizationId }) {
      organization {
        id
        me {
          id
          ...CanAccessTarget_MemberFragment
        }
      }
    }
    target(selector: { organization: $organizationId, project: $projectId, target: $targetId }) {
      id
      graphqlEndpointUrl
      latestSchemaVersion {
        id
        sdl
      }
    }
    ...Laboratory_IsCDNEnabledFragment
  }
`);

function LaboratoryPageContent(props: {
  organizationId: string;
  projectId: string;
  targetId: string;
}) {
  const [query] = useQuery({
    query: TargetLaboratoryPageQuery,
    variables: {
      organizationId: props.organizationId,
      projectId: props.projectId,
      targetId: props.targetId,
    },
  });
  const router = useRouter();
  const [isConnectLabModalOpen, toggleConnectLabModal] = useToggle();
  const [isFullScreen, setIsFullScreen] = useState(false);

  const currentOrganization = query.data?.organization?.organization;

  const operationCollectionsPlugin = useOperationCollectionsPlugin({
    canEdit: canAccessTarget(TargetAccessScope.Settings, currentOrganization?.me ?? null),
    canDelete: canAccessTarget(TargetAccessScope.Delete, currentOrganization?.me ?? null),
    organizationId: props.organizationId,
    projectId: props.projectId,
    targetId: props.targetId,
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
      return `${location.origin}/api/lab/${props.organizationId}/${props.projectId}/${props.targetId}`;
    }

    return '';
  }, [props.organizationId, props.projectId, props.targetId]);

  const fetcher = useMemo<Fetcher>(() => {
    return async (params, opts) => {
      const fetcher = createGraphiQLFetcher({
        url:
          (actualSelectedApiEndpoint === 'linkedApi'
            ? query.data?.target?.graphqlEndpointUrl
            : undefined) ?? mockEndpoint,
        fetch,
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
    return <QueryError organizationId={props.organizationId} error={query.error} />;
  }

  const searchObj = router.latestLocation.search;
  const operation =
    'operation' in searchObj && typeof searchObj.operation === 'string'
      ? searchObj.operation
      : null;

  const FullScreenComponent = isFullScreen ? ExitFullScreenIcon : EnterFullScreenIcon;

  return (
    <TargetLayout
      organizationId={props.organizationId}
      projectId={props.projectId}
      targetId={props.targetId}
      page={Page.Laboratory}
      className="flex h-[--content-height] flex-col"
    >
      <div className="flex py-6">
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
              <RouterLink
                to="/$organizationId/$projectId/$targetId/settings"
                params={{
                  organizationId: props.organizationId,
                  projectId: props.projectId,
                  targetId: props.targetId,
                }}
                search={{
                  page: 'general',
                }}
              >
                <Button variant="outline" className="mr-2" size="sm">
                  Connect GraphQL API Endpoint
                </Button>
              </RouterLink>
            ) : null}
            <Button onClick={toggleConnectLabModal} variant="ghost" size="sm">
              Mock Data Endpoint
            </Button>
          </div>
          <div className="self-end pt-2">
            <span className="mr-2 text-xs font-bold">Query</span>
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
                  'text-xs hover:text-white',
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
                className={cn(
                  'text-xs hover:text-white',
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
      <Helmet>
        <style key="laboratory">{`
        .graphiql-container {
          --color-base: transparent !important;
          --color-primary: 40, 89%, 60% !important;
        }
        .graphiql-container .graphiql-tab-add {
          display: none;
        }
        .graphiql-container .graphiql-toolbar-icon {
          color: #4c5462;
        }

        .graphiql-container .graphiql-doc-explorer-search,
        .graphiql-container .CodeMirror-hints{
          background-color: #070d17;
        }
        .graphiql-container .cm-punctuation {
          color: #ccc;
        }
        .graphiql-container .cm-punctuation:hover {
          color: #fff;
        }

        .graphiql-container .graphiql-logo {
          width: 100%;
          position: relative;
          padding: 12px 16px 0 16px;
        }

        .graphiql-container .graphiql-session-header {
          display: flex;
          flex-direction: column-reverse;
          align-items: flex-start;
          height: auto;
        }

        .graphiql-container .graphiql-session-header-right {
          width: 100%;
        }
      `}</style>
      </Helmet>

      {!query.fetching && (
        <div
          className={clsx(
            'grow',
            isFullScreen && 'fixed inset-0 bg-[#030711]',
            'min-h-0', // trick to allow content be scrollable
          )}
        >
          <GraphiQL
            fetcher={fetcher}
            toolbar={{
              additionalContent: (
                <>
                  <Save
                    organizationId={props.organizationId}
                    projectId={props.projectId}
                    targetId={props.targetId}
                  />
                  <Share operation={operation} />
                </>
              ),
            }}
            showPersistHeadersSettings={false}
            shouldPersistHeaders={false}
            plugins={[operationCollectionsPlugin]}
            visiblePlugin={operationCollectionsPlugin}
            schema={schema}
            forcedTheme="dark"
          >
            <GraphiQL.Logo>
              <EditorBreadcrumbs
                organizationId={props.organizationId}
                projectId={props.projectId}
                targetId={props.targetId}
              />
              <Button
                onClick={() => setIsFullScreen(prev => !prev)}
                variant="outline"
                className="absolute right-3 top-3 gap-2"
              >
                <FullScreenComponent className="size-4" />
                {isFullScreen ? 'Exit' : 'Enter'} Full Screen
              </Button>
            </GraphiQL.Logo>
          </GraphiQL>
        </div>
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

export function TargetLaboratoryPage(props: {
  organizationId: string;
  projectId: string;
  targetId: string;
}) {
  return (
    <>
      <Meta title="Schema laboratory" />
      <LaboratoryPageContent {...props} />
    </>
  );
}

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

function EditorBreadcrumbs(props: { organizationId: string; projectId: string; targetId: string }) {
  const router = useRouter();
  const operationId =
    'operation' in router.latestLocation.search &&
    typeof router.latestLocation.search.operation === 'string'
      ? router.latestLocation.search.operation
      : null;
  const currentOperation = useCurrentOperation(props);

  // Avoiding blinking `New Operation` when switching between operations (when current operation data is not yet fetched)
  if (operationId && (!currentOperation || currentOperation.id !== operationId)) {
    return null;
  }

  return (
    <div className="text-sm font-normal italic">
      {currentOperation?.id ? (
        <>
          {currentOperation.collection.name} <span className="not-italic">{'>'}</span>{' '}
          {currentOperation.name}
        </>
      ) : (
        'New Operation'
      )}
    </div>
  );
}
