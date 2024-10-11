import { ComponentProps, useCallback, useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';
import type { editor } from 'monaco-editor';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Subtitle, Title } from '@/components/ui/page';
import { Switch } from '@/components/ui/switch';
import { useToggle } from '@/lib/hooks';
import { GraphiQLPlugin, useStorageContext } from '@graphiql/react';
import { Editor as MonacoEditor, OnMount } from '@monaco-editor/react';
import {
  CrossCircledIcon,
  ExclamationTriangleIcon,
  InfoCircledIcon,
  Pencil1Icon,
  TriangleRightIcon,
} from '@radix-ui/react-icons';
import type { LogMessage } from './execute-script';
import PreflightWorker from './worker?worker';

const preflightWorker = new PreflightWorker();

export const preflightScriptPlugin: GraphiQLPlugin = {
  icon: () => (
    <svg
      viewBox="0 0 256 256"
      stroke="currentColor"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="16"
    >
      <path d="M136 160h40" />
      <path d="m80 96 40 32-40 32" />
      <rect width="192" height="160" x="32" y="48" rx="8.5" />
    </svg>
  ),
  title: 'Preflight Script',
  content: PreflightScriptContent,
};

const storageKey = {
  script: 'preflightScript:script',
  env: 'preflightScript:env',
  disabled: 'preflightScript:disabled',
};

const classes = {
  monaco: clsx('*:bg-[#10151f]'),
  monacoMini: clsx('h-32 *:rounded-md *:bg-[#10151f]'),
  icon: clsx('absolute -left-5 top-px'),
};

const sharedMonacoProps = {
  theme: 'vs-dark',
  className: classes.monaco,
  options: {
    minimap: { enabled: false },
    padding: {
      top: 10,
    },
    scrollbar: {
      horizontalScrollbarSize: 6,
      verticalScrollbarSize: 6,
    },
  },
} satisfies ComponentProps<typeof MonacoEditor>;

const monacoProps = {
  env: {
    ...sharedMonacoProps,
    defaultLanguage: 'json',
    options: {
      ...sharedMonacoProps.options,
      lineNumbers: 'off',
      tabSize: 2,
    },
  },
  script: {
    ...sharedMonacoProps,
    theme: 'vs-dark',
    defaultLanguage: 'javascript',
    options: {
      ...sharedMonacoProps.options,
    },
  },
} satisfies Record<'script' | 'env', ComponentProps<typeof MonacoEditor>>;

type PreflightScriptResult = {
  logs: LogMessage[];
  environmentVariables: Record<string, unknown>;
};

export async function executeScript(
  script = localStorage.getItem(`graphiql:${storageKey.script}`)!,
  env = localStorage.getItem(`graphiql:${storageKey.env}`)!,
): Promise<PreflightScriptResult> {
  preflightWorker.postMessage({ script, environmentVariables: env ? JSON.parse(env) : {} });

  return new Promise(resolve => {
    preflightWorker.onmessage = (event: MessageEvent<PreflightScriptResult>) => {
      const { logs, environmentVariables } = event.data;
      resolve({ logs, environmentVariables });
    };
    preflightWorker.onerror = error => {
      // Using `warn` instead `error` - to not send to Sentry
      console.warn('Error from preflight worker', error);
    };
  });
}

function PreflightScriptContent() {
  const storage = useStorageContext({ nonNull: true });
  const [script, setScript] = useState(() => storage.get(storageKey.script) ?? '');
  const [env, setEnv] = useState(() => storage.get(storageKey.env) ?? '');
  const [showModal, toggleShowModal] = useToggle();
  const [enableScript, setEnableScript] = useState(
    () => storage.get(storageKey.disabled) !== 'false',
  );

  const handleScriptChange = useCallback((newValue = '') => {
    setScript(newValue);
    storage.set(storageKey.script, newValue);
  }, []);

  const handleEnvChange = useCallback((newValue = '') => {
    setEnv(newValue);
    storage.set(storageKey.env, newValue);
  }, []);

  const handleScriptDisabledChange = useCallback((checked: boolean) => {
    setEnableScript(checked);
    storage.set(storageKey.disabled, String(checked));
  }, []);

  return (
    <>
      <PreflightScriptModal
        // to unmount on submit/close
        key={String(showModal)}
        isOpen={showModal}
        toggle={toggleShowModal}
        scriptValue={script}
        onScriptValueChange={handleScriptChange}
        envValue={env}
        onEnvValueChange={handleEnvChange}
      />
      <div className="graphiql-doc-explorer-title flex items-center justify-between gap-4">
        Preflight Script
        <Button
          variant="orangeLink"
          size="icon-sm"
          className="size-auto gap-1"
          onClick={toggleShowModal}
        >
          <Pencil1Icon className="shrink-0" />
          Edit
        </Button>
      </div>
      <Subtitle>
        This script is run before each operation submitted, e.g. for automated authentication.
      </Subtitle>

      <div className="flex items-center gap-2 text-sm">
        <Switch
          checked={enableScript}
          onCheckedChange={handleScriptDisabledChange}
          className="my-4"
        />
        <span className="w-6">{enableScript ? 'ON' : 'OFF'}</span>
      </div>

      {enableScript && (
        <MonacoEditor
          height={128}
          value={script}
          onChange={handleScriptChange}
          {...monacoProps.script}
          className={classes.monacoMini}
          options={{
            ...monacoProps.script.options,
            lineNumbers: 'off',
            readOnly: true,
          }}
        />
      )}

      <Title className="mt-6 flex gap-2">
        Environment variables{' '}
        <Badge className="text-xs" variant="outline">
          JSON
        </Badge>
      </Title>
      <Subtitle>Define variables to use in your Headers</Subtitle>
      <MonacoEditor
        height={128}
        value={env}
        onChange={handleEnvChange}
        {...monacoProps.env}
        className={classes.monacoMini}
      />
    </>
  );
}

function PreflightScriptModal({
  isOpen,
  toggle,
  scriptValue,
  onScriptValueChange,
  envValue,
  onEnvValueChange,
}: {
  isOpen: boolean;
  toggle: () => void;
  scriptValue: string;
  onScriptValueChange: (value?: string) => void;
  envValue: string;
  onEnvValueChange: (value?: string) => void;
}) {
  const scriptEditorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const envEditorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const [logs, setLogs] = useState<(LogMessage | { type: 'separator' })[]>([]);
  const isScriptRan = useRef(false);
  const consoleRef = useRef<HTMLElement>(null);

  const handleScriptEditorDidMount: OnMount = useCallback(editor => {
    scriptEditorRef.current = editor;
  }, []);

  const handleEnvEditorDidMount: OnMount = useCallback(editor => {
    envEditorRef.current = editor;
  }, []);

  const handleSubmit = useCallback(() => {
    onScriptValueChange(scriptEditorRef.current?.getValue());
    onEnvValueChange(envEditorRef.current?.getValue());
    toggle();
  }, []);

  const handleRunScript = useCallback(async () => {
    const { logs, environmentVariables } = await executeScript(
      scriptEditorRef.current?.getValue() ?? '',
      envEditorRef.current?.getValue() ?? '',
    );
    envEditorRef.current?.setValue(JSON.stringify(environmentVariables, null, 2));
    setLogs(prev =>
      // Add separator only after first run
      isScriptRan.current ? [...prev, { type: 'separator' }, ...logs] : logs,
    );
    isScriptRan.current = true;
  }, []);

  useEffect(() => {
    const consoleEl = consoleRef.current;

    consoleEl?.scroll({ top: consoleEl.scrollHeight, behavior: 'smooth' });
  }, [logs]);

  return (
    <Dialog open={isOpen} onOpenChange={toggle}>
      <DialogContent className="w-11/12 max-w-[unset] xl:w-4/5">
        <DialogHeader>
          <DialogTitle>Edit your Preflight Script</DialogTitle>
          <DialogDescription>
            This script will run in each user's browser and be stored in plain text on our servers.
            Don't share any secrets here 🤫.
            <br />
            All team members can view the script and toggle it off when they need to.
          </DialogDescription>
        </DialogHeader>
        <div className="grid h-[60vh] grid-cols-2 [&_section]:grow">
          <div className="flex flex-col">
            <div className="flex justify-between p-2">
              <Title className="flex gap-2">
                Script Editor
                <Badge className="text-xs" variant="outline">
                  JavaScript
                </Badge>
              </Title>
              <Button
                variant="orangeLink"
                size="icon-sm"
                className="size-auto"
                onClick={handleRunScript}
              >
                <TriangleRightIcon className="shrink-0" /> Run Script
              </Button>
            </div>
            <MonacoEditor
              value={scriptValue}
              onMount={handleScriptEditorDidMount}
              {...monacoProps.script}
              options={{
                ...monacoProps.script.options,
                wordWrap: 'wordWrapColumn',
              }}
            />
          </div>
          <div className="flex h-[inherit] flex-col">
            <Title className="p-2">Console Output</Title>
            <section
              ref={consoleRef}
              className='h-1/2 overflow-hidden overflow-y-scroll bg-[#10151f] py-2.5 pl-[26px] pr-2.5 font-[Menlo,Monaco,"Courier_New",monospace] text-xs/[18px]'
            >
              {logs.map((log, index) => {
                let type = '';
                if (log instanceof Error) {
                  type = 'error';
                  log = `${log.constructor.name}: ${log.message}`;
                }
                if (typeof log === 'string') {
                  type ||= log.split(':')[0].toLowerCase();

                  const ComponentToUse = {
                    error: CrossCircledIcon,
                    warn: ExclamationTriangleIcon,
                    info: InfoCircledIcon,
                  }[type];

                  return (
                    <div
                      key={index}
                      className={clsx(
                        'relative',
                        {
                          error: 'text-red-500',
                          warn: 'text-yellow-500',
                          info: 'text-green-500',
                        }[type],
                      )}
                    >
                      {ComponentToUse && <ComponentToUse className={classes.icon} />}
                      {log}
                    </div>
                  );
                }
                return <hr key={index} className="my-2 border-dashed border-current" />;
              })}
            </section>
            <Title className="flex gap-2 p-2">
              Environment Variables
              <Badge className="text-xs" variant="outline">
                JSON
              </Badge>
            </Title>
            <MonacoEditor
              value={envValue}
              onMount={handleEnvEditorDidMount}
              {...monacoProps.env}
              options={{
                ...monacoProps.env.options,
                wordWrap: 'wordWrapColumn',
              }}
            />
          </div>
        </div>
        <DialogFooter className="items-center">
          <p className="me-5 flex items-center gap-2 text-sm">
            <InfoCircledIcon />
            Changes made to this Preflight Script will apply to all users on your team using this
            variant.
          </p>
          <Button type="button" onClick={toggle}>
            Close
          </Button>
          <Button type="button" variant="primary" onClick={handleSubmit}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
