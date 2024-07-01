import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { FolderIcon, FolderOpenIcon, SquareTerminalIcon } from 'lucide-react';
import { useMutation } from 'urql';
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
import { Title } from '@/components/ui/page';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Link, Spinner } from '@/components/v2';
import { PlusIcon } from '@/components/v2/icon';
import { graphql } from '@/gql';
import { useClipboard, useNotifications, useToggle } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import { useCollections } from '@/pages/target-laboratory';
import { GraphiQLPlugin, useEditorContext } from '@graphiql/react';
import { BookmarkIcon, DotsHorizontalIcon } from '@radix-ui/react-icons';
import { useRouter } from '@tanstack/react-router';
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

export function useOperationCollectionsPlugin(props: {
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
      const copyToClipboard = useClipboard();

      const currentOperation = useCurrentOperation({
        organizationId: props.organizationId,
        projectId: props.projectId,
        targetId: props.targetId,
      });
      const { queryEditor, variableEditor, headerEditor, tabs } = useEditorContext({
        nonNull: true,
      });

      const hasAllEditors = !!(
        editorContext.queryEditor &&
        editorContext.variableEditor &&
        editorContext.headerEditor
      );

      console.log(111, QueryIdMap);

      // console.log(
      //   Object.entries(localStorage)
      //     .filter(([key]) => key.includes('hive:operation-'))
      //     .map(([key, value]) => ({
      //       ...JSON.parse(value),
      //       id: key.replace('hive:operation-', ''),
      //     })),
      // );

      // console.log(collections.flatMap(c => c.operations.edges.map(({ node }) => node)));

      const hasAllEditors = !!(queryEditor && variableEditor && headerEditor);

      const isSame =
        !!currentOperation &&
        currentOperation.query === queryEditor?.getValue() &&
        currentOperation.variables === variableEditor?.getValue() &&
        currentOperation.headers === headerEditor?.getValue();

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
          queryEditor.setValue(currentOperation.query);
          variableEditor.setValue(currentOperation.variables ?? '');
          headerEditor.setValue(currentOperation.headers ?? '');

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
        if (!hasAllEditors || !currentOperation || isSame) {
          return;
        }
        setSavedOperation({
          query: queryEditor.getValue() ?? '',
          variables: variableEditor.getValue() ?? '',
        });
      }, [queryEditor?.getValue(), variableEditor?.getValue()]);

      const shouldShowMenu = props.canEdit || props.canDelete;

      const initialSelectedCollection =
        currentOperation?.id &&
        collections.find(c =>
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
                      collection.operations.edges.map(({ node }) => {
                        const isChanged = node.id === queryParamsOperationId && !isSame;
                        return (
                          <div key={node.id} className="flex items-center justify-between">
                            <Link
                              to="/$organizationId/$projectId/$targetId/laboratory"
                              params={{
                                organizationId: props.organizationId,
                                projectId: props.projectId,
                                targetId: props.targetId,
                              }}
                              search={{ operation: node.id }}
                              className={cn(
                                'flex w-full items-center gap-x-3 rounded p-2 font-normal text-white/50 hover:bg-gray-100/10 hover:text-white',
                                isChanged && 'hive-badge-is-changed relative',
                                node.id === queryParamsOperationId && 'bg-gray-100/10 text-white',
                              )}
                            >
                                <SquareTerminalIcon className="size-4" />
                                {node.name}
                            </Link>
                            <DropdownMenu>
                              <DropdownMenuTrigger className="graphiql-toolbar-button text-white opacity-0 transition-opacity [div:hover>&]:opacity-100">
                                <DotsHorizontalIcon />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={async () => {
                                    const url = new URL(window.location.href);
                                    await copyToClipboard(
                                      `${url.origin}${url.pathname}?operation=${node.id}`,
                                    );
                                  }}
                                >
                                  Copy link to operation
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {props.canEdit && (
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setOperationToEditId(node.id);
                                    }}
                                  >
                                    Edit
                                  </DropdownMenuItem>
                                )}
                                {props.canDelete && (
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setOperationToDeleteId(node.id);
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
                      })
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
                {props.canEdit && (
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
