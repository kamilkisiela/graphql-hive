import { useCallback, useRef, useState } from 'react';
import cryptoJsSource from 'crypto-js/crypto-js.js?raw';
import type { LaboratoryEnv, LaboratoryEnvActions, LaboratoryEnvState } from './env';
import { LaboratoryPlugin } from './plugins';
import { PREFLIGHT_ALLOWED_GLOBALS } from './preflight-allowed-globals';

export interface LaboratoryPreflightLog {
  level: 'log' | 'warn' | 'error' | 'info' | 'system';
  message: unknown[];
  createdAt: string;
  /** Where in the script this came from, when the browser reports a usable stack. */
  line?: number;
  column?: number;
}

/**
 * Maps a stack frame back onto the user's script. The script runs inside a generated
 * `AsyncFunction`, so it starts three lines in (`async function anonymous(…`, `) {`,
 * `with(lab){`). A `console.x` frame points at the member name rather than the statement,
 * which is what `columnOffset` is for.
 */
export const readLineAndColumn = (stack?: string, columnOffset = 0) => {
  const match = stack?.match(/<anonymous>:(\d+):(\d+)/);

  if (!match) {
    return {};
  }

  return { line: Number(match[1]) - 3, column: Number(match[2]) - columnOffset };
};

export interface LaboratoryPreflightResult {
  status: 'success' | 'error';
  error?: string;
  logs: LaboratoryPreflightLog[];
  env: LaboratoryEnv;
  headers: Record<string, string>;
  pluginsState: Record<string, any>;
}

export interface LaboratoryPreflight {
  enabled: boolean;
  script: string;
  lastTestResult?: LaboratoryPreflightResult | null;
}

export interface LaboratoryPreflightState {
  preflight: LaboratoryPreflight | null;
  /** Logs from every run, oldest first, not just the ones started from the Test button. */
  preflightLogs: LaboratoryPreflightLog[];
  isPreflightRunning: boolean;
}

/** The script-supplied parts of a `lab.prompt()` call. */
export interface LaboratoryPreflightPromptField {
  title?: string;
  defaultValue?: string;
  description?: string;
  placeholder?: string;
}

/** A single `lab.prompt()` call waiting on the user. */
export interface LaboratoryPreflightPromptRequest extends LaboratoryPreflightPromptField {
  onSubmit?: (value: string | null) => void;
}

export type LaboratoryPreflightPrompt = (
  title: string,
  defaultValue: string,
  options?: { placeholder?: string; description?: string },
) => Promise<string | null>;

/**
 * How long a script may run before the worker is killed.
 * The clock only covers execution: it is paused while a
 * prompt is waiting on the user.
 */
export const PREFLIGHT_TIMEOUT = 30_000;

/**
 * Environment values are interpolated into headers as text and persisted by the host, so a
 * script can only store JSON scalars. Defined here and injected into the worker by source, so
 * the rule is stated once.
 */
export const isValidEnvValue = (value: unknown) =>
  value === null || ['string', 'number', 'boolean'].includes(typeof value);

/**
 * A function or `Headers` cannot cross postMessage; the clone error would fail the run.
 * Injected by source like `isValidEnvValue`, so no outer references.
 */
export const toLogText = (value: unknown): string => {
  if (typeof value === 'string') {
    return value;
  }

  try {
    return String(value);
  } catch {
    return Object.prototype.toString.call(value);
  }
};

// Shadowed as parameters of the script function, so only valid identifiers. Injected by source.
export const blockedGlobalNames = (names: Iterable<string>, allowed: ReadonlySet<string>) => {
  const blocked = new Set<string>();

  for (const name of names) {
    if (/^[A-Za-z_$][\w$]*$/.test(name) && !allowed.has(name)) {
      blocked.add(name);
    }
  }

  // Not a worker global; undefined instead of a ReferenceError.
  blocked.add('window');

  return Array.from(blocked);
};

export interface LaboratoryPreflightRunOptions {
  /** Aborting terminates the worker and settles the run as an error. */
  signal?: AbortSignal;
  /** Called as each log arrives, so a long-running script reports before it finishes. */
  onLog?: (log: LaboratoryPreflightLog) => void;
}

export interface LaboratoryPreflightActions {
  setPreflight: (preflight: LaboratoryPreflight) => void;
  runPreflight: (
    plugins?: LaboratoryPlugin[],
    pluginsState?: Record<string, any>,
  ) => Promise<LaboratoryPreflightResult | null>;
  /** Runs the script on demand, ignoring `preflight.enabled`, and records the result. */
  testPreflight: (
    plugins?: LaboratoryPlugin[],
    pluginsState?: Record<string, any>,
  ) => Promise<LaboratoryPreflightResult | null>;
  /** Stops every in-flight run and releases any prompt waiting on the user. */
  abortPreflight: () => void;
  clearPreflightLogs: () => void;
  setLastTestResult: (result: LaboratoryPreflightResult | null) => void;
}

/**
 * Owns the one prompt dialog every preflight run shares. Runs overlap in practice (an
 * operation run while schema polling has a prompt open), and only one request can be on
 * screen, so a displaced request is answered with null rather than left waiting.
 */
export const usePreflightPrompt = () => {
  const [isPreflightPromptModalOpen, setIsPreflightPromptModalOpen] = useState(false);

  const [preflightPromptModalProps, setPreflightPromptModalProps] =
    useState<LaboratoryPreflightPromptRequest>({});

  const pendingPromptRef = useRef<LaboratoryPreflightPromptRequest['onSubmit']>(undefined);

  const answerPendingPrompt = useCallback((value: string | null) => {
    const pending = pendingPromptRef.current;
    pendingPromptRef.current = undefined;
    pending?.(value);
  }, []);

  const openPreflightPromptModal = useCallback(
    (request: LaboratoryPreflightPromptRequest) => {
      answerPendingPrompt(null);
      pendingPromptRef.current = request.onSubmit;

      setPreflightPromptModalProps({
        title: request.title,
        description: request.description,
        placeholder: request.placeholder,
        defaultValue: request.defaultValue,
        onSubmit: answerPendingPrompt,
      });

      setTimeout(() => {
        setIsPreflightPromptModalOpen(true);
      }, 200);
    },
    [answerPendingPrompt],
  );

  // Aborting a run leaves its dialog on screen with a script that no longer exists to answer,
  // so stopping closes it and releases the request with null.
  const closePreflightPromptModal = useCallback(() => {
    answerPendingPrompt(null);
    setIsPreflightPromptModalOpen(false);
  }, [answerPendingPrompt]);

  return {
    isPreflightPromptModalOpen,
    setIsPreflightPromptModalOpen,
    preflightPromptModalProps,
    openPreflightPromptModal,
    closePreflightPromptModal,
  };
};

export const usePreflight = (props: {
  defaultPreflight?: LaboratoryPreflight | null;
  onPreflightChange?: (preflight: LaboratoryPreflight | null) => void;
  envApi: LaboratoryEnvState & LaboratoryEnvActions;
  openPreflightPromptModal?: (request: LaboratoryPreflightPromptRequest) => void;
  /** Releases a prompt still waiting on the user, so aborting doesn't strand the dialog. */
  closePreflightPromptModal?: () => void;
}): LaboratoryPreflightState & LaboratoryPreflightActions => {
  const [preflight, _setPreflight] = useState<LaboratoryPreflight | null>(
    props.defaultPreflight ?? null,
  );

  // Seeded from the stored result so a reload still shows the last run, then owned entirely
  // by the runs themselves. Reading from both this and `lastTestResult` would make Clear look
  // broken: emptying one just falls back to the other.
  const [preflightLogs, setPreflightLogs] = useState<LaboratoryPreflightLog[]>(
    () => props.defaultPreflight?.lastTestResult?.logs ?? [],
  );
  const [runCount, setRunCount] = useState(0);

  // Runs overlap (an operation run, a schema poll, a Test run), so stopping has to reach all
  // of them rather than only the most recent.
  const runsRef = useRef(new Set<AbortController>());

  const setPreflight = useCallback(
    (preflight: LaboratoryPreflight) => {
      _setPreflight(preflight);
      props.onPreflightChange?.(preflight);
    },
    [props],
  );

  const { openPreflightPromptModal, closePreflightPromptModal } = props;

  const runScript = useCallback(
    async (script: string, plugins?: LaboratoryPlugin[], pluginsState?: Record<string, any>) => {
      const run = new AbortController();
      runsRef.current.add(run);
      setRunCount(runsRef.current.size);

      try {
        return await runIsolatedLabScript(
          script,
          props.envApi?.env ?? { variables: {} },
          openPreflightPromptModal
            ? (title, defaultValue, options) =>
                new Promise<string | null>(resolve =>
                  openPreflightPromptModal({
                    title,
                    defaultValue,
                    placeholder: options?.placeholder,
                    description: options?.description,
                    onSubmit: resolve,
                  }),
                )
            : undefined,
          plugins,
          pluginsState,
          {
            signal: run.signal,
            onLog: log => setPreflightLogs(previous => [...previous, log]),
          },
        );
      } finally {
        runsRef.current.delete(run);
        setRunCount(runsRef.current.size);
      }
    },
    [props.envApi.env, openPreflightPromptModal],
  );

  const runPreflight = useCallback(
    async (plugins?: LaboratoryPlugin[], pluginsState?: Record<string, any>) => {
      if (!preflight?.enabled) {
        return null;
      }

      return runScript(preflight.script, plugins, pluginsState);
    },
    [preflight, runScript],
  );

  // The Test button runs the script the user is editing, whether or not preflight is enabled.
  const testPreflight = useCallback(
    async (plugins?: LaboratoryPlugin[], pluginsState?: Record<string, any>) =>
      runScript(preflight?.script ?? '', plugins, pluginsState),
    [preflight?.script, runScript],
  );

  const abortPreflight = useCallback(() => {
    for (const run of runsRef.current) {
      run.abort();
    }

    runsRef.current.clear();
    setRunCount(0);
    closePreflightPromptModal?.();
  }, [closePreflightPromptModal]);

  const clearPreflightLogs = useCallback(() => {
    setPreflightLogs([]);
  }, []);

  const setLastTestResult = useCallback(
    (result: LaboratoryPreflightResult | null) => {
      _setPreflight({
        ...(preflight ?? { script: '', enabled: true }),
        lastTestResult: result,
      });
      props.onPreflightChange?.({
        ...(preflight ?? { script: '', enabled: true }),
        lastTestResult: result,
      });
    },
    [preflight, props],
  );

  return {
    preflight,
    preflightLogs,
    isPreflightRunning: runCount > 0,
    setPreflight,
    runPreflight,
    testPreflight,
    abortPreflight,
    clearPreflightLogs,
    setLastTestResult,
  };
};

export async function runIsolatedLabScript(
  script: string,
  env: LaboratoryEnv,
  prompt?: LaboratoryPreflightPrompt,
  plugins: LaboratoryPlugin[] = [],
  pluginsState: Record<string, any> = {},
  options?: LaboratoryPreflightRunOptions,
): Promise<LaboratoryPreflightResult> {
  const pluginsObjects = plugins
    .filter(plugin => plugin.preflight?.lab?.object)
    .map(plugin => plugin.preflight?.lab?.object);

  return new Promise(resolve => {
    const blob = new Blob(
      [
        cryptoJsSource.replace('}(this, function () {', '}(self, function () {'),
        /* javascript */ `
        const env =  {
          variables: ${JSON.stringify(env?.variables)} || {},
        };

        let promptResolve = null;

        // Declared out here because the catch below needs it too, and a const inside the try
        // would be out of scope exactly when a script has just failed.
        const readLineAndColumn = ${readLineAndColumn.toString()};
        const toLogText = ${toLogText.toString()};
        const blockedGlobalNames = ${blockedGlobalNames.toString()};
        const allowedGlobals = new Set(${JSON.stringify(Array.from(PREFLIGHT_ALLOWED_GLOBALS))});

        self.onmessage = async (event) => {
          if (event.data.type === 'prompt:result') {
            promptResolve?.(event.data.value || null);
          }

          if (event.data.type === 'init') {
            try {
              // 'console.'.length: the reported column points at the member, not the statement.
              const postLog = (level) => (...args) => {
                self.postMessage({
                  type: 'log',
                  level,
                  message: args.map(toLogText),
                  ...readLineAndColumn(new Error().stack, 8),
                });
              };

              self.console = {
                log: postLog('log'),
                warn: postLog('warn'),
                error: postLog('error'),
                info: postLog('info'),
              };

              let state = ${JSON.stringify(pluginsState)};

              const setState = (id, newState) => {
                Object.assign(state[id] ?? {}, newState);
              };
              
              const isValidEnvValue = ${isValidEnvValue.toString()};

              const lab = Object.freeze({
                CryptoJS,
                environment: {
                  get: (key) => env.variables[key],
                  set: (key, value) => {
                    if (!isValidEnvValue(value)) {
                      console.warn(
                        'lab.environment stores strings, numbers, booleans and null. The value for "' + key + '" was dropped.'
                      );
                      // Dropping the key too, so an older value can't survive under a name the
                      // script believes it just overwrote.
                      delete env.variables[key];
                      return;
                    }

                    env.variables[key] = value;
                  },
                  delete: (key) => {
                    delete env.variables[key];
                  }
                },
                request: {
                  headers: new Headers()
                },
                prompt: (title, defaultValue, options) => {
                  return new Promise((resolve) => {
                    promptResolve = resolve;
                    self.postMessage({ type: 'prompt', title, defaultValue, options: options ?? {} });
                  });
                },
                plugins: {
                  ${pluginsObjects
                    .map(obj => obj?.toString())
                    .map(obj => (obj?.startsWith('object') ? `function${obj.slice(6)}` : obj))
                    .map(
                      (obj, i) => `
                   ...(${obj})(${JSON.stringify(plugins[i].preflight?.lab?.props ?? {})}, state['${plugins[i].id}'] ?? {}, (newState) => setState('${plugins[i].id}', newState))  
                  `,
                    )
                    .join(',')}
                }
              });
  
              // for...in adds the enumerable worker members on the prototype chain.
              const globalNames = Object.getOwnPropertyNames(globalThis);
              for (const name in globalThis) {
                globalNames.push(name);
              }
              const blockedGlobals = blockedGlobalNames(globalNames, allowedGlobals);

              // call('undefined'): sloppy mode would otherwise make this the worker scope.
              // The script sits on its own line so reported lines map back by a fixed offset.
              const AsyncFunction = async function () {}.constructor;
              await new AsyncFunction('lab', 'CryptoJS', ...blockedGlobals, 'with(lab){\\n' + event.data.script + '\\n}').call('undefined', lab, CryptoJS);

              self.postMessage({ type: 'result', env: env, headers: Object.fromEntries(lab.request.headers.entries()), pluginsState: state });
            } catch (err) {
              const message = err && err.message ? err.message : toLogText(err);

              self.postMessage({
                type: 'log',
                level: 'error',
                message: [message],
                ...readLineAndColumn(err && err.stack),
              });
              self.postMessage({ type: 'result', error: message });
            }
          }
        };
      `,
      ],
      { type: 'application/javascript' },
    );

    const logs: LaboratoryPreflightLog[] = [];
    const headers: Record<string, string> = {};

    const workerUrl = URL.createObjectURL(blob);
    const worker = new Worker(workerUrl, { type: 'module' });

    let isSettled = false;

    const pushLog = (log: LaboratoryPreflightLog) => {
      logs.push(log);
      options?.onLog?.(log);
    };

    let timeout: ReturnType<typeof setTimeout> | undefined;

    const stopTimeout = () => {
      clearTimeout(timeout);
      timeout = undefined;
    };

    const startTimeout = () => {
      stopTimeout();

      timeout = setTimeout(() => {
        pushLog({
          level: 'system',
          message: [`Run timed out after ${PREFLIGHT_TIMEOUT / 1000} seconds.`],
          createdAt: new Date().toISOString(),
        });

        settle({
          status: 'error',
          error: `Preflight execution timed out after ${PREFLIGHT_TIMEOUT / 1000} seconds`,
          logs,
          env,
          headers: {},
          pluginsState,
        });
      }, PREFLIGHT_TIMEOUT);
    };

    const abort = () => {
      // Output otherwise just stops mid-script with nothing saying why.
      pushLog({
        level: 'system',
        message: ['Run stopped.'],
        createdAt: new Date().toISOString(),
      });

      settle({
        status: 'error',
        error: 'Preflight aborted',
        logs,
        env,
        headers: {},
        pluginsState,
      });
    };

    // Single exit for the run: without it a failed run leaves its worker running and its blob
    // URL alive for the rest of the session.
    const settle = (result: LaboratoryPreflightResult) => {
      if (isSettled) {
        return;
      }

      isSettled = true;
      stopTimeout();
      options?.signal?.removeEventListener('abort', abort);
      worker.terminate();
      URL.revokeObjectURL(workerUrl);
      resolve(result);
    };

    worker.onmessage = ({ data }) => {
      if (data.type === 'result') {
        if (data.error) {
          settle({
            status: 'error',
            error: data.error,
            logs,
            env,
            // The worker sends neither of these when the script throws.
            headers: {},
            pluginsState: data.pluginsState ?? pluginsState,
          });
        } else {
          if (Object.keys(data.headers).length > 0) {
            pushLog({
              level: 'system',
              message: [`Headers:\n${JSON.stringify(data.headers, null, 2)}`],
              createdAt: new Date().toISOString(),
            });
          }

          settle({
            status: 'success',
            logs,
            env: data.env,
            headers: data.headers,
            pluginsState: data.pluginsState,
          });
        }
      } else if (data.type === 'log') {
        if (['log', 'warn', 'error', 'info'].includes(data.level)) {
          pushLog({
            level: data.level,
            message: data.message,
            createdAt: new Date().toISOString(),
            line: data.line,
            column: data.column,
          });
        }
      } else if (data.type === 'header') {
        headers[data.name] = data.value;

        pushLog({
          level: 'system',
          message: [`Header ${data.name} set to ${data.value}`],
          createdAt: new Date().toISOString(),
        });
      } else if (data.type === 'prompt') {
        // The script is parked until the user answers, and how long they take is not the
        // script's execution time, so the clock stops until the answer goes back.
        stopTimeout();

        // Without an answer the script awaits `lab.prompt()` forever and the worker never
        // reports a result, so a missing handler has to answer with null.
        const answer =
          prompt?.(data.title, data.defaultValue, data.options) ?? Promise.resolve(null);

        void answer
          .catch(() => null)
          .then(value => {
            // A run that was aborted or timed out while the dialog was open has already
            // terminated its worker; the late answer is simply dropped.
            if (!isSettled) {
              startTimeout();
              worker.postMessage({ type: 'prompt:result', value });
            }
          });
      }
    };

    worker.onerror = error => {
      settle({
        status: 'error',
        error: error.message,
        logs,
        env,
        headers: {},
        pluginsState,
      });
    };

    if (options?.signal?.aborted) {
      abort();
      return;
    }

    options?.signal?.addEventListener('abort', abort);

    startTimeout();
    worker.postMessage({ type: 'init', script });
  });
}
