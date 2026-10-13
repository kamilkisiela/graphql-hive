import {
  ReactNode,
  useCallback,
  useEffect,
  useInsertionEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import laboratoryStyles from '../../index.css?inline';
import { BookOpenIcon, FileIcon, FoldersIcon, HistoryIcon, SettingsIcon } from 'lucide-react';
import monacoStyles from 'monaco-editor/min/vs/editor/editor.main.css?inline';
import * as z from 'zod';
import { useForm } from '@tanstack/react-form';
import { useCollections } from '../../lib/collections';
import { useDocs } from '../../lib/docs';
import { registerDocsHover } from '../../lib/docs-hover';
import { ensureDocumentFontFaces } from '../../lib/document-styles';
import { useEndpoint } from '../../lib/endpoint';
import { useEnv } from '../../lib/env';
import { useHistory } from '../../lib/history';
import { keepEditorMouseMovesInShadowRoot } from '../../lib/monaco-shadow-dom';
import {
  useOperations,
  type LaboratoryOperationsActions,
  type LaboratoryOperationsState,
} from '../../lib/operations';
import { LaboratoryPluginTab, usePlugins } from '../../lib/plugins';
import { usePreflight, usePreflightPrompt } from '../../lib/preflight';
import { useSettings } from '../../lib/settings';
import { ensureShadowRoot } from '../../lib/shadow-root';
import { LaboratoryTabCustom, useTabs } from '../../lib/tabs';
import { useTests } from '../../lib/tests';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '../ui/empty';
import { Field, FieldError, FieldGroup, FieldLabel } from '../ui/field';
import { Input } from '../ui/input';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '../ui/resizable';
import { Toaster } from '../ui/sonner';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { Collections } from './collections';
import { Command } from './command';
import {
  LaboratoryPermission,
  LaboratoryPermissions,
  LaboratoryProvider,
  useLaboratory,
  type LaboratoryApi,
} from './context';
import { Docs } from './docs';
import { Env } from './env';
import { History } from './history';
import { HistoryItem } from './history-item';
import { Operation } from './operation';
import { Preflight } from './preflight';
import { PreflightPromptModal } from './preflight-prompt-modal';
import { Settings } from './settings';
import { Tabs } from './tabs';

const ShadowRootContainer = (props: { children: ReactNode }) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [shadowRoot, setShadowRoot] = useState<ShadowRoot | null>(null);

  useLayoutEffect(() => {
    if (!hostRef.current || shadowRoot) {
      return;
    }

    setShadowRoot(ensureShadowRoot(hostRef.current));
  }, [shadowRoot]);

  useLayoutEffect(() => {
    if (!shadowRoot) {
      return;
    }

    return keepEditorMouseMovesInShadowRoot(shadowRoot);
  }, [shadowRoot]);

  useLayoutEffect(() => {
    if (!shadowRoot) {
      return;
    }

    document.head.querySelectorAll('style').forEach(style => {
      if (style.textContent?.includes('[data-sonner-toaster]')) {
        shadowRoot.append(style.cloneNode(true));
      }
    });
  }, [shadowRoot]);

  return (
    <div ref={hostRef} className="hive-laboratory-host size-full">
      {shadowRoot ? createPortal(props.children, shadowRoot) : null}
    </div>
  );
};

const addCollectionFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
});

const updateEndpointFormSchema = z.object({
  endpoint: z.string().min(1, 'Endpoint is required'),
});

const addTestFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
});

const LaboratoryContent = () => {
  const {
    activeTab,
    addOperation,
    addTab,
    setActiveTab,
    preflight,
    tabs,
    env,
    plugins,
    pluginsState,
    setPluginsState,
    activePanel,
    setActivePanel,
    enableDocs,
    openDocs,
    schema,
  } = useLaboratory();
  const laboratory = useLaboratory();
  const [commandOpen, setCommandOpen] = useState(false);

  // Read through a ref so a schema poll does not tear down and re-register the
  // provider, which would drop an open hover.
  const schemaRef = useRef(schema);
  schemaRef.current = schema;

  useEffect(() => {
    if (!enableDocs) {
      return;
    }

    return registerDocsHover({
      getSchema: () => schemaRef.current ?? null,
      openDocs,
    });
  }, [enableDocs, openDocs]);

  const contentNode = useMemo(() => {
    switch (activeTab?.type) {
      case 'operation':
        return <Operation />;
      case 'preflight':
        return <Preflight />;
      case 'env':
        return <Env />;
      case 'history':
        return <HistoryItem />;
      case 'settings':
        return <Settings />;
      default: {
        let pluginId: string | null = null;
        let customTab: LaboratoryPluginTab<Record<string, unknown>> | null = null;

        for (const plugin of plugins) {
          for (const tab of plugin.tabs ?? []) {
            if (tab.type === activeTab?.type) {
              customTab = tab;
              pluginId = plugin.id;
              break;
            }
          }
        }

        if (customTab && pluginId) {
          return customTab.component(
            activeTab as LaboratoryTabCustom,
            laboratory,
            pluginsState[pluginId] ?? {},
            (state: Record<string, unknown>) =>
              setPluginsState({ ...pluginsState, [pluginId]: state }),
          );
        }

        return (
          <Empty className="w-full px-0!">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FileIcon className="size-6 text-muted-foreground" />
              </EmptyMedia>
              <EmptyTitle>No operation selected</EmptyTitle>
              <EmptyDescription>
                You haven't selected any operation yet. Get started by selecting an operation or add
                a new one.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button
                size="sm"
                onClick={() => {
                  const operation = addOperation({
                    name: '',
                    query: '',
                    variables: '',
                    headers: '',
                    extensions: '',
                  });

                  const tab = addTab({
                    type: 'operation',
                    data: operation,
                  });

                  setActiveTab(tab);
                }}
              >
                Add operation
              </Button>
            </EmptyContent>
          </Empty>
        );
      }
    }
  }, [activeTab?.type, addOperation, addTab, setActiveTab]);

  return (
    <div className="flex size-full">
      <Command open={commandOpen} onOpenChange={setCommandOpen} />
      <div className="flex h-full w-12 flex-col">
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={cn(
                'relative z-10 flex aspect-square h-12 w-full items-center justify-center border-l-2 border-transparent',
                {
                  'border-primary': activePanel === 'collections',
                },
              )}
            >
              <Button
                variant="ghost"
                size="icon"
                aria-label="Collections"
                onClick={() => setActivePanel(activePanel === 'collections' ? null : 'collections')}
                className={cn('text-muted-foreground hover:text-foreground', {
                  'text-foreground': activePanel === 'collections',
                })}
              >
                <FoldersIcon className="size-5" />
              </Button>
            </div>
          </TooltipTrigger>
          <TooltipContent side="right">Collections</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={cn(
                'relative z-10 flex aspect-square h-12 w-full items-center justify-center border-l-2 border-transparent',
                {
                  'border-primary': activePanel === 'history',
                },
              )}
            >
              <Button
                variant="ghost"
                size="icon"
                aria-label="History"
                onClick={() => setActivePanel(activePanel === 'history' ? null : 'history')}
                className={cn('text-muted-foreground hover:text-foreground', {
                  'text-foreground': activePanel === 'history',
                })}
              >
                <HistoryIcon className="size-5" />
              </Button>
            </div>
          </TooltipTrigger>
          <TooltipContent side="right">History</TooltipContent>
        </Tooltip>
        {enableDocs ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  'relative z-10 flex aspect-square h-12 w-full items-center justify-center border-l-2 border-transparent',
                  {
                    'border-primary': activePanel === 'docs',
                  },
                )}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Documentation"
                  onClick={() => setActivePanel(activePanel === 'docs' ? null : 'docs')}
                  className={cn('text-muted-foreground hover:text-foreground', {
                    'text-foreground': activePanel === 'docs',
                  })}
                >
                  <BookOpenIcon className="size-5" />
                </Button>
              </div>
            </TooltipTrigger>
            <TooltipContent side="right">Documentation</TooltipContent>
          </Tooltip>
        ) : null}
        <div
          className={cn(
            'relative z-100 mt-auto flex aspect-square h-12 w-full items-center justify-center border-l-2 border-transparent',
            {
              'border-primary': activePanel === 'settings',
            },
          )}
        >
          <Tooltip>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Settings"
                    className={cn('text-muted-foreground hover:text-foreground', {
                      'text-foreground': activePanel === 'settings',
                    })}
                  >
                    <SettingsIcon className="size-5" />
                  </Button>
                </TooltipTrigger>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="mb-2 w-56" align="start" side="right">
                <DropdownMenuGroup>
                  <DropdownMenuItem onSelect={() => setCommandOpen(true)}>
                    Command Palette...
                    <DropdownMenuShortcut>⌘J</DropdownMenuShortcut>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => {
                    const tab =
                      tabs.find(t => t.type === 'env') ??
                      addTab({
                        type: 'env',
                        data: env ?? { variables: {} },
                      });

                    setActiveTab(tab);
                  }}
                >
                  Environment Variables
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    const tab =
                      tabs.find(t => t.type === 'preflight') ??
                      addTab({
                        type: 'preflight',
                        data: preflight ?? { script: '' },
                      });

                    setActiveTab(tab);
                  }}
                >
                  Preflight Script
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => {
                    const tab =
                      tabs.find(t => t.type === 'settings') ??
                      addTab({
                        type: 'settings',
                        data: {},
                      });

                    setActiveTab(tab);
                  }}
                >
                  Settings
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <TooltipContent side="right">Settings</TooltipContent>
          </Tooltip>
        </div>
      </div>
      <ResizablePanelGroup orientation="horizontal" className="h-full flex-1">
        <ResizablePanel minSize="10%" defaultSize="17%" hidden={!activePanel} className="border-l">
          {activePanel === 'collections' && <Collections />}
          {activePanel === 'history' && <History />}
          {activePanel === 'docs' && <Docs />}
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel minSize="10%" defaultSize="83%" className="flex flex-col">
          <div className="w-full">
            <Tabs />
          </div>
          <div className="relative flex-1 overflow-hidden bg-card">{contentNode}</div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};

export type LaboratoryProps = LaboratoryApi;

export const Laboratory = (
  props: Partial<
    Pick<
      LaboratoryProps,
      | 'permissions'
      | 'defaultEndpoint'
      | 'onEndpointChange'
      | 'defaultCollections'
      | 'onCollectionsChange'
      | 'onCollectionCreate'
      | 'onCollectionUpdate'
      | 'onCollectionDelete'
      | 'onCollectionOperationCreate'
      | 'onCollectionOperationUpdate'
      | 'onCollectionOperationDelete'
      | 'defaultOperations'
      | 'onOperationsChange'
      | 'defaultActiveOperationId'
      | 'onActiveOperationIdChange'
      | 'onOperationCreate'
      | 'onOperationUpdate'
      | 'onOperationDelete'
      | 'defaultHistory'
      | 'onHistoryChange'
      | 'onHistoryCreate'
      | 'onHistoryUpdate'
      | 'onHistoryDelete'
      | 'defaultTabs'
      | 'onTabsChange'
      | 'defaultPreflight'
      | 'onPreflightChange'
      | 'defaultEnv'
      | 'onEnvChange'
      | 'defaultActiveTabId'
      | 'onActiveTabIdChange'
      | 'defaultSettings'
      | 'onSettingsChange'
      | 'defaultTests'
      | 'onTestsChange'
      | 'plugins'
      | 'defaultPluginsState'
      | 'onPluginsStateChange'
      | 'theme'
      | 'defaultSchemaIntrospection'
      | 'enableFullScreen'
      | 'enableDocs'
    >
  >,
) => {
  const checkPermissions = useCallback(
    (
      permission: `${keyof LaboratoryPermissions & string}:${keyof LaboratoryPermission & string}`,
    ) => {
      const [namespace, action] = permission.split(':');

      return (
        props.permissions?.[namespace as keyof LaboratoryPermissions]?.[
          action as keyof LaboratoryPermission
        ] ?? true
      );
    },
    [props.permissions],
  );

  // Called before the API hooks so `usePreflight` can answer `lab.prompt()` calls from
  // scripts running as part of an operation, not just from the preflight Test button.
  const {
    isPreflightPromptModalOpen,
    setIsPreflightPromptModalOpen,
    preflightPromptModalProps,
    openPreflightPromptModal,
    closePreflightPromptModal,
  } = usePreflightPrompt();

  const settingsApi = useSettings(props);
  const envApi = useEnv(props);
  const preflightApi = usePreflight({
    ...props,
    envApi,
    openPreflightPromptModal,
    closePreflightPromptModal,
  });

  const { abortPreflight } = preflightApi;

  // A run outlives the lab otherwise: the worker keeps going after the host unmounts.
  useEffect(() => abortPreflight, [abortPreflight]);

  const pluginsApi = usePlugins(props);
  const testsApi = useTests(props);
  const tabsApi = useTabs(props);
  // Operations are set up after collections, so the id hand-off reaches them through a ref.
  const operationsApiRef = useRef<(LaboratoryOperationsState & LaboratoryOperationsActions) | null>(
    null,
  );
  const collectionsApi = useCollections({
    ...props,
    tabsApi,
    onOperationIdChange: (previousId, id) => {
      operationsApiRef.current?.replaceOperationId(previousId, id);
      tabsApi.replaceOperationId(previousId, id);
    },
  });
  const docsApi = useDocs({
    defaultActivePanel: collectionsApi.collections.length > 0 ? 'collections' : null,
  });
  const operationsApi = useOperations({
    ...props,
    collectionsApi,
    tabsApi,
    envApi,
    preflightApi,
    settingsApi,
    pluginsApi,
    checkPermissions,
  });
  operationsApiRef.current = operationsApi;
  const endpointApi = useEndpoint({
    ...props,
    settingsApi,
    operationsApi,
    envApi,
    pluginsApi,
    preflightApi,
  });

  const historyApi = useHistory(props);

  const [isAddCollectionDialogOpen, setIsAddCollectionDialogOpen] = useState(false);

  const [isUpdateEndpointDialogOpen, setIsUpdateEndpointDialogOpen] = useState(false);

  const [isAddTestDialogOpen, setIsAddTestDialogOpen] = useState(false);

  const openAddCollectionDialog = useCallback(() => {
    setIsAddCollectionDialogOpen(true);
  }, []);

  const openUpdateEndpointDialog = useCallback(() => {
    setIsUpdateEndpointDialogOpen(true);
  }, []);

  const openAddTestDialog = useCallback(() => {
    setIsAddTestDialogOpen(true);
  }, []);

  const addCollectionForm = useForm({
    defaultValues: {
      name: '',
    },
    validators: {
      onSubmit: addCollectionFormSchema,
    },
    onSubmit: ({ value }) => {
      collectionsApi.addCollection({
        name: value.name,
      });
      setIsAddCollectionDialogOpen(false);
    },
  });

  const updateEndpointForm = useForm({
    defaultValues: {
      endpoint: endpointApi.endpoint ?? '',
    },
    validators: {
      onSubmit: updateEndpointFormSchema,
    },
    onSubmit: ({ value }) => {
      endpointApi.setEndpoint(value.endpoint);
      setIsUpdateEndpointDialogOpen(false);
    },
  });

  const addTestForm = useForm({
    defaultValues: {
      name: '',
    },
    validators: {
      onSubmit: addTestFormSchema,
    },
    onSubmit: ({ value }) => {
      testsApi.addTest({ name: value.name });
      setIsAddTestDialogOpen(false);
    },
  });

  const [container, setContainer] = useState<HTMLDivElement | null>(null);

  const [isFullScreen, setIsFullScreen] = useState(false);

  const goToFullScreen = useCallback(() => {
    setIsFullScreen(true);
  }, []);

  const exitFullScreen = useCallback(() => {
    setIsFullScreen(false);
  }, []);

  useInsertionEffect(() => {
    ensureDocumentFontFaces(monacoStyles);
  }, []);

  return (
    <ShadowRootContainer>
      <style>{`${laboratoryStyles}\n${monacoStyles}`}</style>
      <div
        className={cn('hive-laboratory size-full bg-background', props.theme, {
          'fixed inset-0 z-50': isFullScreen,
        })}
        ref={setContainer}
      >
        <Toaster richColors closeButton position="top-right" theme={props.theme} />

        <LaboratoryProvider
          {...props}
          {...testsApi}
          {...settingsApi}
          {...pluginsApi}
          {...envApi}
          {...preflightApi}
          {...tabsApi}
          {...endpointApi}
          {...collectionsApi}
          {...operationsApi}
          {...historyApi}
          {...docsApi}
          container={container}
          openAddCollectionDialog={openAddCollectionDialog}
          openUpdateEndpointDialog={openUpdateEndpointDialog}
          openAddTestDialog={openAddTestDialog}
          openPreflightPromptModal={openPreflightPromptModal}
          goToFullScreen={goToFullScreen}
          exitFullScreen={exitFullScreen}
          isFullScreen={isFullScreen}
          enableFullScreen={props.enableFullScreen !== false}
          enableDocs={props.enableDocs === true}
          checkPermissions={checkPermissions}
        >
          <Dialog open={isUpdateEndpointDialogOpen} onOpenChange={setIsUpdateEndpointDialogOpen}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Update endpoint</DialogTitle>
                <DialogDescription>Update the endpoint of your laboratory.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4">
                <form
                  id="update-endpoint-form"
                  onSubmit={e => {
                    e.preventDefault();
                    void updateEndpointForm.handleSubmit();
                  }}
                >
                  <FieldGroup>
                    <updateEndpointForm.Field name="endpoint">
                      {field => {
                        const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

                        return (
                          <Input
                            id={field.name}
                            name={field.name}
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={e => field.handleChange(e.target.value)}
                            aria-invalid={isInvalid}
                            placeholder="Enter endpoint"
                            autoComplete="off"
                          />
                        );
                      }}
                    </updateEndpointForm.Field>
                  </FieldGroup>
                </form>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button type="submit" form="update-endpoint-form">
                  Update endpoint
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <PreflightPromptModal
            open={isPreflightPromptModalOpen}
            onOpenChange={setIsPreflightPromptModalOpen}
            {...preflightPromptModalProps}
          />
          <Dialog open={isAddCollectionDialogOpen} onOpenChange={setIsAddCollectionDialogOpen}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Add collection</DialogTitle>
                <DialogDescription>
                  Add a new collection of operations to your laboratory.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4">
                <form
                  id="add-collection-form"
                  onSubmit={e => {
                    e.preventDefault();
                    void addCollectionForm.handleSubmit();
                  }}
                >
                  <FieldGroup>
                    <addCollectionForm.Field name="name">
                      {field => {
                        const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                        return (
                          <Field data-invalid={isInvalid}>
                            <FieldLabel htmlFor={field.name}>Name</FieldLabel>
                            <Input
                              id={field.name}
                              name={field.name}
                              value={field.state.value}
                              onBlur={field.handleBlur}
                              onChange={e => field.handleChange(e.target.value)}
                              aria-invalid={isInvalid}
                              placeholder="Enter name of the collection"
                              autoComplete="off"
                            />
                            {isInvalid && <FieldError errors={field.state.meta.errors} />}
                          </Field>
                        );
                      }}
                    </addCollectionForm.Field>
                  </FieldGroup>
                </form>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button type="submit" form="add-collection-form">
                  Add collection
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={isAddTestDialogOpen} onOpenChange={setIsAddTestDialogOpen}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Add test</DialogTitle>
                <DialogDescription>Add a new test to your laboratory.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4">
                <form
                  id="add-test-form"
                  onSubmit={e => {
                    e.preventDefault();
                    void addTestForm.handleSubmit();
                  }}
                >
                  <FieldGroup>
                    <addTestForm.Field name="name">
                      {field => {
                        const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                        return (
                          <Field data-invalid={isInvalid}>
                            <FieldLabel htmlFor={field.name}>Name</FieldLabel>
                            <Input
                              id={field.name}
                              name={field.name}
                              value={field.state.value}
                              onBlur={field.handleBlur}
                              onChange={e => field.handleChange(e.target.value)}
                              aria-invalid={isInvalid}
                              placeholder="Enter name of the test"
                              autoComplete="off"
                            />
                            {isInvalid && <FieldError errors={field.state.meta.errors} />}
                          </Field>
                        );
                      }}
                    </addTestForm.Field>
                  </FieldGroup>
                </form>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button type="submit" form="add-test-form">
                  Add test
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <LaboratoryContent />
        </LaboratoryProvider>
      </div>
    </ShadowRootContainer>
  );
};
