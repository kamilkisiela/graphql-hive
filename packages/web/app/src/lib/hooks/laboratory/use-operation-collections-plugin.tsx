import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { FolderIcon, FolderOpenIcon, SquareTerminalIcon } from 'lucide-react';
import { useMutation, useQuery } from 'urql';
import { CreateCollectionModal } from '@/components/target/laboratory/create-collection-modal';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PlusIcon } from '@/components/ui/icon';
import { Link } from '@/components/ui/link';
import { Spinner } from '@/components/ui/spinner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { graphql } from '@/gql';
import { TargetAccessScope } from '@/gql/graphql';
import { canAccessTarget } from '@/lib/access/target';
import { useClipboard, useNotifications, useToggle } from '@/lib/hooks';
import { useOperationFromQueryString } from '@/lib/hooks/laboratory/useOperationFromQueryString';
import { cn } from '@/lib/utils';
import { GraphiQLPlugin, useEditorContext, usePluginContext } from '@graphiql/react';
import { BookmarkFilledIcon, BookmarkIcon, DotsHorizontalIcon } from '@radix-ui/react-icons';
import { useParams, useRouter } from '@tanstack/react-router';
import { useCollections } from './use-collections';
import { useCurrentOperation } from './use-current-operation';
import { useSyncOperationState } from './use-sync-operation-state';

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

export const TargetLaboratoryPageQuery = graphql(`
  query TargetLaboratoryPageQuery(
    $organizationSlug: String!
    $projectSlug: String!
    $targetSlug: String!
  ) {
    organization(selector: { organizationSlug: $organizationSlug }) {
      organization {
        id
        me {
          id
          ...CanAccessTarget_MemberFragment
        }
      }
    }
    target(
      selector: {
        organizationSlug: $organizationSlug
        projectSlug: $projectSlug
        targetSlug: $targetSlug
      }
    ) {
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

export const operationCollectionsPlugin: GraphiQLPlugin = {
  title: 'Operation Collections',
  content: Content,
  icon: function Icon() {
    const pluginContext = usePluginContext();
    const IconToUse =
      pluginContext?.visiblePlugin === operationCollectionsPlugin
        ? BookmarkFilledIcon
        : BookmarkIcon;
    return <IconToUse />;
  },
};

export function Content() {
  const { organizationSlug, projectSlug, targetSlug } = useParams({ strict: false }) as {
    organizationSlug: string;
    projectSlug: string;
    targetSlug: string;
  };
  const [query] = useQuery({
    query: TargetLaboratoryPageQuery,
    variables: {
      organizationSlug,
      projectSlug,
      targetSlug,
    },
  });
  const currentOrganization = query.data?.organization?.organization;
  const canEdit = canAccessTarget(TargetAccessScope.Settings, currentOrganization?.me ?? null);
  const canDelete = canAccessTarget(TargetAccessScope.Delete, currentOrganization?.me ?? null);

  const [isCollectionModalOpen, toggleCollectionModal] = useToggle();
  const { collections, fetching: loading } = useCollections({
    organizationSlug,
    projectSlug,
    targetSlug,
  });
  const [collectionId, setCollectionId] = useState('');
  const [isDeleteCollectionModalOpen, toggleDeleteCollectionModalOpen] = useToggle();
  const [isDeleteOperationModalOpen, toggleDeleteOperationModalOpen] = useToggle();
  const [operationToDeleteId, setOperationToDeleteId] = useState<null | string>(null);
  const [operationToEditId, setOperationToEditId] = useState<null | string>(null);
  const { clearOperation, savedOperation, setSavedOperation } = useSyncOperationState({
    organizationSlug,
    projectSlug,
    targetSlug,
  });
  const router = useRouter();
  const [accordionValue, setAccordionValue] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const copyToClipboard = useClipboard();

  const currentOperation = useCurrentOperation({
    organizationSlug,
    projectSlug,
    targetSlug,
  });
  const { queryEditor, variableEditor, headerEditor, tabs, changeTab, addTab } = useEditorContext({
    nonNull: true,
  });

  const hasAllEditors = !!(queryEditor && variableEditor && headerEditor);
  const queryParamsOperationId = useOperationFromQueryString();
  const activeTab = tabs.find(tab => tab.id === queryParamsOperationId);

  const isSame =
    !currentOperation ||
    !activeTab ||
    (currentOperation.query === activeTab.query &&
      currentOperation.variables === activeTab.variables &&
      currentOperation.headers === (activeTab.headers || ''));

  useEffect(() => {
    if (!hasAllEditors || !currentOperation) {
      const searchObj = router.latestLocation.search;
      const operationString =
        'operationString' in searchObj && typeof searchObj.operationString === 'string'
          ? searchObj.operationString
          : null;

      // We provide an operation string when navigating to the laboratory from persisted documents
      // in that case we want to show that operation within this tab.
      if (operationString) {
        queryEditor?.setValue(operationString);
        variableEditor?.setValue('');
        headerEditor?.setValue('');
      }

      return;
    }

    if (queryParamsOperationId) {
      const tabIndex = tabs.findIndex(tab => tab.id === queryParamsOperationId);

      if (tabIndex !== -1) {
        changeTab(tabIndex);
        return;
      }
      // Set selected operation in editors
      addTab({
        id: queryParamsOperationId,
        query: (savedOperation || currentOperation).query,
        variables: (savedOperation || currentOperation).variables,
        headers: currentOperation.headers,
        title: currentOperation.name,
      });

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
        queryEditor.setValue(savedOperation.query);
        variableEditor.setValue(savedOperation.variables);
      }
    }
  }, [hasAllEditors, queryParamsOperationId, currentOperation]);

  useEffect(() => {
    // updateActiveTabValues({ className: isSame ? '' : tabBadgeClassName });
    if (!hasAllEditors || !currentOperation || isSame) {
      return;
    }
    setSavedOperation({
      query: queryEditor.getValue() || '',
      variables: variableEditor.getValue() || '',
    });
  }, [queryEditor?.getValue(), variableEditor?.getValue()]);

  const shouldShowMenu = canEdit || canDelete;

  const initialSelectedCollection =
    currentOperation?.id &&
    collections.find(c => c.operations.edges.some(({ node }) => node.id === currentOperation.id))
      ?.id;

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
        targetSlug,
        organizationSlug,
        projectSlug,
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
        to: '/$organizationSlug/$projectSlug/$targetSlug/laboratory',
        params: {
          organizationSlug,
          projectSlug,
          targetSlug,
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

  const renderedCollections = collections.map(collection => (
    <AccordionItem key={collection.id} value={collection.id} className="border-b-0">
      <AccordionHeader className="flex items-center justify-between">
        <AccordionTriggerPrimitive className="group flex w-full items-center gap-x-3 rounded p-2 text-left font-medium text-white hover:bg-gray-100/10">
          <FolderIcon className="group-radix-state-open:hidden size-4" />
          <FolderOpenIcon className="group-radix-state-closed:hidden size-4" />
          {collection.name}
        </AccordionTriggerPrimitive>
        {shouldShowMenu && (
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
        )}
      </AccordionHeader>
      <AccordionContent className="space-y-0 pb-2 pl-2">
        {collection.operations.edges.length ? (
          collection.operations.edges.map(({ node }) => (
            <div key={node.id} className="flex items-center">
              <Link
                to="/$organizationSlug/$projectSlug/$targetSlug/laboratory"
                params={{
                  organizationSlug,
                  projectSlug,
                  targetSlug,
                }}
                search={{ operation: node.id }}
                className={cn(
                  'flex w-full items-center gap-x-3 rounded p-2 font-normal text-white/50 hover:bg-gray-100/10 hover:text-white hover:no-underline',
                  node.id === queryParamsOperationId && [
                    'bg-gray-100/10 text-white',
                    currentOperation &&
                      node.id === currentOperation.id &&
                      !isSame &&
                      'hive-badge-is-changed relative',
                  ],
                )}
              >
                <SquareTerminalIcon className="size-4" />
                {node.name}
              </Link>
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger className="graphiql-toolbar-button text-white opacity-0 transition-opacity [div:hover>&]:opacity-100">
                  <DotsHorizontalIcon />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={async () => {
                      const url = new URL(window.location.href);
                      await copyToClipboard(`${url.origin}${url.pathname}?operation=${node.id}`);
                    }}
                  >
                    Copy link to operation
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {canEdit && (
                    <DropdownMenuItem
                      onClick={() => {
                        setOperationToEditId(node.id);
                      }}
                    >
                      Edit
                    </DropdownMenuItem>
                  )}
                  {canDelete && (
                    <DropdownMenuItem
                      onClick={() => {
                        setOperationToDeleteId(node.id);
                        toggleDeleteOperationModalOpen();
                      }}
                      className="text-red-500"
                    >
                      Delete
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
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
  ));

  return (
    <>
      <div className="mb-5 flex items-center justify-between gap-1">
        <div className="graphiql-doc-explorer-title">Operations</div>
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
      ) : collections.length ? (
        <Accordion
          ref={containerRef}
          value={accordionValue}
          onValueChange={setAccordionValue}
          type="multiple"
        >
          {renderedCollections}
        </Accordion>
      ) : (
        <div className="flex h-fit flex-1 items-center justify-center">
          <div className="flex flex-col items-center">
            <BookmarkIcon width={30} height={30} />
            <div className="mt-2 text-xs">There are no collections available.</div>
            {canEdit && (
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
            )}
          </div>
        </div>
      )}
      <CreateCollectionModal
        organizationSlug={organizationSlug}
        projectSlug={projectSlug}
        targetSlug={targetSlug}
        isOpen={isCollectionModalOpen}
        toggleModalOpen={toggleCollectionModal}
        collectionId={collectionId}
      />
      <DeleteCollectionModal
        organizationSlug={organizationSlug}
        projectSlug={projectSlug}
        targetSlug={targetSlug}
        isOpen={isDeleteCollectionModalOpen}
        toggleModalOpen={toggleDeleteCollectionModalOpen}
        collectionId={collectionId}
      />
      {operationToDeleteId && (
        <DeleteOperationModal
          organizationSlug={organizationSlug}
          projectSlug={projectSlug}
          targetSlug={targetSlug}
          isOpen={isDeleteOperationModalOpen}
          toggleModalOpen={toggleDeleteOperationModalOpen}
          operationId={operationToDeleteId}
        />
      )}
      {operationToEditId && (
        <EditOperationModal
          organizationSlug={organizationSlug}
          projectSlug={projectSlug}
          targetSlug={targetSlug}
          operationId={operationToEditId}
          close={() => setOperationToEditId(null)}
        />
      )}
    </>
  );
}
