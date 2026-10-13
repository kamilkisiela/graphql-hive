// @vitest-environment happy-dom
import { createHash } from 'node:crypto';
import { act, renderHook } from '@testing-library/react';
import {
  blockedGlobalNames,
  isValidEnvValue,
  PREFLIGHT_TIMEOUT,
  readLineAndColumn,
  runIsolatedLabScript,
  toLogText,
  usePreflight,
  usePreflightPrompt,
  type LaboratoryPreflightPromptRequest,
} from './preflight';

/** The real worker never runs under happy-dom, so the tests drive its message protocol. */
class FakeWorker {
  static instances: FakeWorker[] = [];

  onmessage: ((event: { data: any }) => void) | null = null;
  onerror: ((error: unknown) => void) | null = null;
  posted: any[] = [];
  terminateCount = 0;

  constructor() {
    FakeWorker.instances.push(this);
  }

  postMessage(data: any) {
    this.posted.push(data);
  }

  terminate() {
    this.terminateCount++;
  }

  emit(data: any) {
    this.onmessage?.({ data });
  }

  fail(message: string) {
    this.onerror?.({ message });
  }
}

const lastWorker = () => FakeWorker.instances[FakeWorker.instances.length - 1];

let revokeObjectURL: ReturnType<typeof vi.fn<(url: string) => void>>;

beforeEach(() => {
  FakeWorker.instances = [];
  vi.stubGlobal('Worker', FakeWorker);
  revokeObjectURL = vi.fn<(url: string) => void>();
  URL.createObjectURL = vi.fn(() => 'blob:preflight-spec');
  URL.revokeObjectURL = revokeObjectURL;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('runIsolatedLabScript', () => {
  it('answers a prompt with the value from the handler', async () => {
    const prompt = vi.fn().mockResolvedValue('dog');

    void runIsolatedLabScript('await lab.prompt("Noun")', { variables: {} }, prompt);

    lastWorker().emit({ type: 'prompt', title: 'Noun', defaultValue: undefined, options: {} });

    await vi.waitFor(() => {
      expect(lastWorker().posted).toContainEqual({ type: 'prompt:result', value: 'dog' });
    });
    expect(prompt).toHaveBeenCalledWith('Noun', undefined, {});
  });

  it('passes the prompt metadata through to the handler', async () => {
    const prompt = vi.fn().mockResolvedValue('hv_123');

    void runIsolatedLabScript('await lab.prompt("API token")', { variables: {} }, prompt);

    lastWorker().emit({
      type: 'prompt',
      title: 'API token',
      defaultValue: 'hv_',
      options: { placeholder: 'hv_...', description: 'Used for this request only' },
    });

    await vi.waitFor(() => {
      expect(prompt).toHaveBeenCalledWith('API token', 'hv_', {
        placeholder: 'hv_...',
        description: 'Used for this request only',
      });
    });
  });

  it('answers with null when the handler rejects', async () => {
    const prompt = vi.fn().mockRejectedValue(new Error('modal blew up'));

    void runIsolatedLabScript('await lab.prompt("Noun")', { variables: {} }, prompt);

    lastWorker().emit({ type: 'prompt', title: 'Noun', defaultValue: undefined, options: {} });

    await vi.waitFor(() => {
      expect(lastWorker().posted).toContainEqual({ type: 'prompt:result', value: null });
    });
  });

  // Without a reply the script awaits `lab.prompt()` forever and the run never resolves.
  it('answers with null when no handler is supplied', async () => {
    void runIsolatedLabScript('await lab.prompt("Noun")', { variables: {} });

    lastWorker().emit({ type: 'prompt', title: 'Noun', defaultValue: undefined, options: {} });

    await vi.waitFor(() => {
      expect(lastWorker().posted).toContainEqual({ type: 'prompt:result', value: null });
    });
  });
});

describe('readLineAndColumn', () => {
  // Shape verified against V8: the script starts three lines into the generated function.
  const stack = 'Error: boom\n    at eval (eval at <anonymous> ([eval]:4:12), <anonymous>:5:7)';

  it('maps a frame back onto the script', () => {
    expect(readLineAndColumn(stack)).toEqual({ line: 2, column: 7 });
  });

  // `console.log('hi')` on script line 2 reports column 9, pointing at `log` rather than the
  // start of the statement; the offset walks it back.
  it('applies the column offset to a console frame', () => {
    const consoleFrame = 'Error\n    at eval (eval at <anonymous> ([eval]:4:12), <anonymous>:5:9)';

    expect(readLineAndColumn(consoleFrame, 'console.'.length)).toEqual({ line: 2, column: 1 });
  });

  it.each([undefined, 'Error: boom\n    at blob:http://localhost/abc:12:3'])(
    'reports nothing usable for %s',
    value => {
      expect(readLineAndColumn(value)).toEqual({});
    },
  );
});

describe('isValidEnvValue', () => {
  it.each([['a string'], [42], [true], [null]])('keeps %s', value => {
    expect(isValidEnvValue(value)).toBe(true);
  });

  it.each([[{ nope: true }], [['a']], [undefined], [() => {}]])('rejects %s', value => {
    expect(isValidEnvValue(value)).toBe(false);
  });

  // The rule is defined in TypeScript and shipped into the worker as source, so the two can't
  // drift; this proves the injection actually happens.
  it('is injected into the worker that runs the script', async () => {
    let workerSource = '';
    URL.createObjectURL = vi.fn((blob: Blob) => {
      void blob.text().then(text => (workerSource = text));
      return 'blob:preflight-spec';
    }) as unknown as typeof URL.createObjectURL;

    void runIsolatedLabScript('lab.environment.set("a", {})', { variables: {} });

    await vi.waitFor(() => {
      expect(workerSource).toContain('isValidEnvValue(value)');
    });
  });
});

describe('blockedGlobalNames', () => {
  const allowed = new Set(['fetch', 'console']);

  it('keeps valid identifiers that are not allowed, then window', () => {
    const names = ['fetch', 'self', 'foo-bar', '0', '@wry/context:Slot', 'console', 'process'];

    expect(blockedGlobalNames(names, allowed)).toEqual(['self', 'process', 'window']);
  });

  it('dedupes names seen through both enumerations', () => {
    expect(blockedGlobalNames(['self', 'self', 'window'], allowed)).toEqual(['self', 'window']);
  });
});

describe('toLogText', () => {
  it.each([
    ['a string', 'a string'],
    [42, '42'],
    [null, 'null'],
    [undefined, 'undefined'],
    [new Error('boom'), 'Error: boom'],
    [Object.create(null), '[object Object]'],
  ])('turns %s into text', (value, expected) => {
    expect(toLogText(value)).toBe(expected);
  });
});

// The suite drives the message protocol with a fake worker, so nothing else here executes the
// generated worker source. A ReferenceError in it silently costs a run: the script's failure is
// swallowed, no result is posted, and the lab waits for the timeout.
describe('the generated worker source', () => {
  const runWorkerSource = async (
    script: string,
    options: {
      answerPrompt?: (request: { title: string; defaultValue?: string }) => string | null;
    } = {},
  ) => {
    let workerSource = '';
    URL.createObjectURL = vi.fn((blob: Blob) => {
      void blob.text().then(text => (workerSource = text));
      return 'blob:preflight-spec';
    }) as unknown as typeof URL.createObjectURL;

    void runIsolatedLabScript(script, { variables: {} });
    await vi.waitFor(() => expect(workerSource).not.toBe(''));

    const posted: any[] = [];
    const self: Record<string, any> = {
      postMessage: (message: any) => {
        // Like the real boundary: an uncloneable value throws back into the script.
        posted.push(structuredClone(message));

        // The main thread answers on a later task.
        if (message.type === 'prompt' && options.answerPrompt) {
          setTimeout(() => {
            void self.onmessage({
              data: { type: 'prompt:result', value: options.answerPrompt?.(message) },
            });
          }, 0);
        }
      },
      // The script's AsyncFunction sees the real global, not this fake `self`; in a worker they
      // are the same object. Unstubbed in afterEach.
      get console() {
        return globalThis.console;
      },
      set console(value) {
        vi.stubGlobal('console', value);
      },
    };

    // In a worker `self` is the global scope, so what the source hangs off it — CryptoJS, the
    // replaced console — is reachable as a bare identifier. `with` gives the sandbox the same
    // lookup, rather than the source resolving to node's console and posting nothing.
    new Function('self', `with (self) {${workerSource}}`)(self);

    await self.onmessage({ data: { type: 'init', script } });

    return posted;
  };

  it('reports a script failure instead of going quiet', async () => {
    const posted = await runWorkerSource('throw new Error("boom");');

    expect(posted).toContainEqual(expect.objectContaining({ type: 'result', error: 'boom' }));
    expect(posted).toContainEqual(
      expect.objectContaining({ type: 'log', level: 'error', message: ['boom'] }),
    );
  });

  it('reports a successful run', async () => {
    const posted = await runWorkerSource('lab.environment.set("a", "1");');

    expect(posted).toContainEqual(
      expect.objectContaining({ type: 'result', env: { variables: { a: '1' } } }),
    );
  });

  it('drops non-scalar environment values with a warning', async () => {
    const posted = await runWorkerSource('lab.environment.set("a", { nope: true });');

    expect(posted).toContainEqual(expect.objectContaining({ type: 'log', level: 'warn' }));
    expect(posted).toContainEqual(
      expect.objectContaining({ type: 'result', env: { variables: {} } }),
    );
  });

  it('reports a non-Error throw instead of going quiet', async () => {
    const posted = await runWorkerSource('throw null;');

    expect(posted).toContainEqual(expect.objectContaining({ type: 'result', error: 'null' }));
  });

  it('logs values that cannot be structured-cloned', async () => {
    const posted = await runWorkerSource('console.log(lab.request.headers, () => {}, null);');

    const log = posted.find(message => message.type === 'log');
    expect(log.message).toHaveLength(3);
    expect(log.message.every((part: unknown) => typeof part === 'string')).toBe(true);
    expect(log.message[2]).toBe('null');
    expect(posted).toContainEqual(
      expect.objectContaining({ type: 'result', env: { variables: {} } }),
    );
  });

  it('hides worker and host globals from the script', async () => {
    const posted = await runWorkerSource(
      'console.log(typeof self, typeof globalThis, typeof postMessage, typeof process);',
    );

    expect(posted).toContainEqual(
      expect.objectContaining({
        type: 'log',
        message: ['undefined', 'undefined', 'undefined', 'undefined'],
      }),
    );
  });

  it('keeps the allowed globals reachable', async () => {
    const posted = await runWorkerSource(
      'console.log(typeof fetch, typeof setTimeout, typeof URL, typeof TextEncoder, typeof crypto, typeof Uint8Array, typeof Intl, typeof CryptoJS, typeof lab);',
    );

    expect(posted).toContainEqual(
      expect.objectContaining({
        type: 'log',
        message: [
          'function',
          'function',
          'function',
          'function',
          'object',
          'function',
          'object',
          'object',
          'object',
        ],
      }),
    );
  });

  it('does not hand the script the worker scope as this', async () => {
    const posted = await runWorkerSource('console.log(String(this), typeof this.postMessage);');

    expect(posted).toContainEqual(
      expect.objectContaining({ type: 'log', message: ['undefined', 'undefined'] }),
    );
  });

  it('hands the script null for an empty prompt answer', async () => {
    const posted = await runWorkerSource('console.log(await lab.prompt("Noun"));', {
      answerPrompt: () => '',
    });

    expect(posted).toContainEqual(expect.objectContaining({ type: 'log', message: ['null'] }));
  });

  it('exposes CryptoJS on lab and as a bare name', async () => {
    const posted = await runWorkerSource(
      'console.log(typeof lab.CryptoJS.SHA256, typeof CryptoJS.SHA256);',
    );

    expect(posted).toContainEqual(
      expect.objectContaining({ type: 'log', message: ['function', 'function'] }),
    );
  });

  // The same saved script runs on both laboratory tabs.
  it('runs a script written for the GraphiQL tab', async () => {
    const script = [
      "console.log('preflight worker is running');",
      "lab.environment.set('ran-at', new Date().toISOString());",
      "console.info('ran-at =', lab.environment.get('ran-at'));",
      "const digest = lab.CryptoJS.SHA256('hive').toString();",
      "console.info('sha256(hive) =', digest);",
      "lab.request.headers.set('x-preflight-test', digest.slice(0, 8));",
      "const answer = await lab.prompt('Type anything to confirm the prompt bridge works', 'ok');",
      "console.warn('prompt returned:', answer);",
    ].join('\n');

    const posted = await runWorkerSource(script, { answerPrompt: () => 'ok' });

    const digest = createHash('sha256').update('hive').digest('hex');
    const result = posted.find(message => message.type === 'result');
    expect(result.error).toBeUndefined();
    expect(Date.parse(result.env.variables['ran-at'])).not.toBeNaN();
    expect(result.headers).toEqual({ 'x-preflight-test': digest.slice(0, 8) });

    expect(posted).toContainEqual(
      expect.objectContaining({
        type: 'prompt',
        title: 'Type anything to confirm the prompt bridge works',
        defaultValue: 'ok',
      }),
    );

    const messages = posted.filter(message => message.type === 'log').map(m => m.message);
    expect(messages).toContainEqual(['preflight worker is running']);
    expect(messages).toContainEqual(['sha256(hive) =', digest]);
    expect(messages).toContainEqual(['prompt returned:', 'ok']);
  });
});

describe('runIsolatedLabScript cleanup', () => {
  const settledResult = { type: 'result', env: { variables: {} }, headers: {}, pluginsState: {} };

  it('terminates the worker and revokes its url when a run succeeds', async () => {
    const run = runIsolatedLabScript('lab.environment.set("a", "1")', { variables: {} });

    lastWorker().emit(settledResult);

    await expect(run).resolves.toMatchObject({ status: 'success' });
    expect(lastWorker().terminateCount).toBe(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:preflight-spec');
  });

  it('cleans up when the script throws', async () => {
    const run = runIsolatedLabScript('throw new Error("boom")', { variables: {} });

    lastWorker().emit({ type: 'result', error: 'boom' });

    // The worker sends no headers alongside a script error, so the result must not claim any.
    await expect(run).resolves.toMatchObject({ status: 'error', error: 'boom', headers: {} });
    expect(lastWorker().terminateCount).toBe(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:preflight-spec');
  });

  it('cleans up when the worker itself fails', async () => {
    const run = runIsolatedLabScript('syntax error', { variables: {} });

    lastWorker().fail('Unexpected identifier');

    await expect(run).resolves.toMatchObject({ status: 'error', error: 'Unexpected identifier' });
    expect(lastWorker().terminateCount).toBe(1);
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
  });

  it('settles once even if the worker reports twice', async () => {
    const run = runIsolatedLabScript('lab.environment.set("a", "1")', { variables: {} });

    lastWorker().emit(settledResult);
    lastWorker().emit({ type: 'result', error: 'late failure' });

    await expect(run).resolves.toMatchObject({ status: 'success' });
    expect(lastWorker().terminateCount).toBe(1);
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
  });
});

describe('runIsolatedLabScript run control', () => {
  it('reports logs as they arrive, before the run settles', async () => {
    const onLog = vi.fn();

    const run = runIsolatedLabScript(
      'console.log("working")',
      { variables: {} },
      undefined,
      [],
      {},
      { onLog },
    );

    lastWorker().emit({ type: 'log', level: 'log', message: ['working'], line: 2, column: 1 });

    expect(onLog).toHaveBeenCalledWith(
      expect.objectContaining({ level: 'log', line: 2, column: 1 }),
    );

    lastWorker().emit({ type: 'result', env: { variables: {} }, headers: {}, pluginsState: {} });
    await run;
  });

  it('stops a run when its signal aborts', async () => {
    const controller = new AbortController();

    const run = runIsolatedLabScript(
      'while (true) {}',
      { variables: {} },
      undefined,
      [],
      {},
      {
        signal: controller.signal,
      },
    );

    controller.abort();

    await expect(run).resolves.toMatchObject({ status: 'error', error: 'Preflight aborted' });
    expect(lastWorker().terminateCount).toBe(1);
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
  });

  it('drops a prompt answered after the run was aborted', async () => {
    const controller = new AbortController();
    let answerPrompt: (value: string | null) => void = () => {};
    const prompt = vi.fn(() => new Promise<string | null>(resolve => (answerPrompt = resolve)));

    const run = runIsolatedLabScript(
      'await lab.prompt("Token")',
      { variables: {} },
      prompt,
      [],
      {},
      { signal: controller.signal },
    );

    lastWorker().emit({ type: 'prompt', title: 'Token', defaultValue: undefined, options: {} });
    controller.abort();
    await expect(run).resolves.toMatchObject({ status: 'error' });

    answerPrompt('too late');

    await vi.waitFor(() => {
      expect(lastWorker().posted).not.toContainEqual({
        type: 'prompt:result',
        value: 'too late',
      });
    });
  });

  it('settles immediately when the signal is already aborted', async () => {
    const run = runIsolatedLabScript(
      'console.log(1)',
      { variables: {} },
      undefined,
      [],
      {},
      {
        signal: AbortSignal.abort(),
      },
    );

    await expect(run).resolves.toMatchObject({ status: 'error', error: 'Preflight aborted' });
    expect(lastWorker().posted).not.toContainEqual(expect.objectContaining({ type: 'init' }));
  });
});

describe('runIsolatedLabScript timeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('kills a script that never finishes', async () => {
    const run = runIsolatedLabScript('while (true) {}', { variables: {} });

    await vi.advanceTimersByTimeAsync(PREFLIGHT_TIMEOUT);

    await expect(run).resolves.toMatchObject({
      status: 'error',
      error: 'Preflight execution timed out after 30 seconds',
    });
    expect(lastWorker().terminateCount).toBe(1);
  });

  it('says so in the logs when a run times out', async () => {
    const onLog = vi.fn();

    const run = runIsolatedLabScript(
      'while (true) {}',
      { variables: {} },
      undefined,
      [],
      {},
      {
        onLog,
      },
    );

    await vi.advanceTimersByTimeAsync(PREFLIGHT_TIMEOUT);
    await run;

    expect(onLog).toHaveBeenCalledWith(
      expect.objectContaining({ level: 'system', message: ['Run timed out after 30 seconds.'] }),
    );
  });

  // The budget is for the script, not for how long the user takes to find a token.
  it('does not spend the budget while a prompt waits on the user', async () => {
    let answerPrompt: (value: string | null) => void = () => {};
    const prompt = vi.fn(() => new Promise<string | null>(resolve => (answerPrompt = resolve)));

    const run = runIsolatedLabScript('await lab.prompt("Token")', { variables: {} }, prompt);

    lastWorker().emit({ type: 'prompt', title: 'Token', defaultValue: undefined, options: {} });

    await vi.advanceTimersByTimeAsync(PREFLIGHT_TIMEOUT * 3);

    answerPrompt('hv_123');
    await vi.advanceTimersByTimeAsync(0);

    expect(lastWorker().posted).toContainEqual({ type: 'prompt:result', value: 'hv_123' });

    lastWorker().emit({ type: 'result', env: { variables: {} }, headers: {}, pluginsState: {} });

    await expect(run).resolves.toMatchObject({ status: 'success' });
  });

  it('stops the clock once the run settles', async () => {
    const run = runIsolatedLabScript('console.log(1)', { variables: {} });

    lastWorker().emit({ type: 'result', env: { variables: {} }, headers: {}, pluginsState: {} });

    await expect(run).resolves.toMatchObject({ status: 'success' });

    await vi.advanceTimersByTimeAsync(PREFLIGHT_TIMEOUT * 2);

    expect(lastWorker().terminateCount).toBe(1);
  });
});

describe('usePreflight run control', () => {
  const mount = () =>
    renderHook(() =>
      usePreflight({
        defaultPreflight: { enabled: true, script: 'console.log("hi")' },
        envApi: { env: { variables: {} }, setEnv: vi.fn() },
      }),
    );

  // Clearing used to empty the live logs and then fall straight back to the stored result,
  // so the pane redrew the same lines and the button looked broken.
  it('stays cleared when a stored result exists', () => {
    const { result } = renderHook(() =>
      usePreflight({
        defaultPreflight: {
          enabled: true,
          script: 'console.log("hi")',
          lastTestResult: {
            status: 'success',
            logs: [{ level: 'log', message: ['from the last run'], createdAt: '2026-01-01' }],
            env: { variables: {} },
            headers: {},
            pluginsState: {},
          },
        },
        envApi: { env: { variables: {} }, setEnv: vi.fn() },
      }),
    );

    expect(result.current.preflightLogs).toHaveLength(1);

    act(() => {
      result.current.clearPreflightLogs();
    });

    expect(result.current.preflightLogs).toHaveLength(0);
  });

  it('says so in the logs when a run is stopped', async () => {
    const { result } = mount();

    let run: Promise<unknown> | undefined;
    act(() => {
      run = result.current.runPreflight();
    });

    await act(async () => {
      result.current.abortPreflight();
      await run;
    });

    expect(result.current.preflightLogs.at(-1)).toMatchObject({
      level: 'system',
      message: ['Run stopped.'],
    });
  });

  it('collects logs from every run, not just the Test button', async () => {
    const { result } = mount();

    act(() => {
      void result.current.runPreflight();
    });

    act(() => {
      lastWorker().emit({ type: 'log', level: 'log', message: ['from an operation run'] });
    });

    expect(result.current.preflightLogs).toHaveLength(1);
    expect(result.current.preflightLogs[0].message).toEqual(['from an operation run']);

    act(() => {
      result.current.clearPreflightLogs();
    });

    expect(result.current.preflightLogs).toHaveLength(0);
  });

  it('runs the script from the Test button even when preflight is disabled', async () => {
    const { result } = renderHook(() =>
      usePreflight({
        defaultPreflight: { enabled: false, script: 'console.log("hi")' },
        envApi: { env: { variables: {} }, setEnv: vi.fn() },
      }),
    );

    await act(async () => {
      expect(await result.current.runPreflight()).toBeNull();
    });

    act(() => {
      void result.current.testPreflight();
    });

    expect(FakeWorker.instances).toHaveLength(1);
  });

  // A Test run, an operation run and a schema poll can all be in flight, so stopping has to
  // reach every one of them rather than the most recent.
  it('aborts every in-flight run and releases the open prompt', async () => {
    const closePreflightPromptModal = vi.fn();
    const { result } = renderHook(() =>
      usePreflight({
        defaultPreflight: { enabled: true, script: 'console.log("hi")' },
        envApi: { env: { variables: {} }, setEnv: vi.fn() },
        closePreflightPromptModal,
      }),
    );

    let runs: Promise<unknown>[] = [];
    act(() => {
      runs = [result.current.runPreflight(), result.current.testPreflight()];
    });

    expect(FakeWorker.instances).toHaveLength(2);
    expect(result.current.isPreflightRunning).toBe(true);

    await act(async () => {
      result.current.abortPreflight();
      await Promise.all(runs);
    });

    expect(FakeWorker.instances.map(worker => worker.terminateCount)).toEqual([1, 1]);
    expect(closePreflightPromptModal).toHaveBeenCalled();
    expect(result.current.isPreflightRunning).toBe(false);
  });
});

describe('usePreflightPrompt', () => {
  // The dialog opens on a timer, so the tests drive it rather than waiting on it.
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('opens the modal with the requested prompt', () => {
    const { result } = renderHook(() => usePreflightPrompt());

    act(() => {
      result.current.openPreflightPromptModal({
        title: 'Noun',
        defaultValue: 'dog',
        placeholder: 'e.g. cat',
        description: 'Any noun will do',
      });
      vi.advanceTimersByTime(200);
    });

    expect(result.current.isPreflightPromptModalOpen).toBe(true);
    expect(result.current.preflightPromptModalProps).toMatchObject({
      title: 'Noun',
      defaultValue: 'dog',
      placeholder: 'e.g. cat',
      description: 'Any noun will do',
    });
  });

  it('answers each request once', () => {
    const onSubmit = vi.fn();
    const { result } = renderHook(() => usePreflightPrompt());

    act(() => {
      result.current.openPreflightPromptModal({ title: 'Noun', onSubmit });
    });

    act(() => {
      result.current.preflightPromptModalProps.onSubmit?.('dog');
      result.current.preflightPromptModalProps.onSubmit?.(null);
    });

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith('dog');
  });

  // Runs overlap: an operation run can prompt while schema polling already has one open.
  // Only one request fits on screen, so the displaced one has to be released.
  it('answers a displaced request with null instead of leaving it waiting', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { result } = renderHook(() => usePreflightPrompt());

    act(() => {
      result.current.openPreflightPromptModal({ title: 'Noun', onSubmit: first });
      result.current.openPreflightPromptModal({ title: 'Verb', onSubmit: second });
    });

    expect(first).toHaveBeenCalledWith(null);
    expect(result.current.preflightPromptModalProps.title).toBe('Verb');

    act(() => {
      result.current.preflightPromptModalProps.onSubmit?.('run');
    });

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledWith('run');
  });
});

describe('usePreflight', () => {
  const mountPreflight = (
    openPreflightPromptModal?: (request: LaboratoryPreflightPromptRequest) => void,
  ) =>
    renderHook(() =>
      usePreflight({
        defaultPreflight: { enabled: true, script: 'await lab.prompt("Noun")' },
        envApi: { env: { variables: {} }, setEnv: vi.fn() },
        openPreflightPromptModal,
      }),
    );

  // Running an operation goes through `runPreflight`, which used to pass no prompt handler at
  // all, so a script prompting there hung instead of opening the modal.
  it('opens the prompt modal and returns the submitted value', async () => {
    const openPreflightPromptModal = vi.fn();
    const { result } = mountPreflight(openPreflightPromptModal);

    let run: Promise<unknown> | undefined;
    act(() => {
      run = result.current.runPreflight();
    });

    lastWorker().emit({ type: 'prompt', title: 'Noun', defaultValue: undefined, options: {} });

    await vi.waitFor(() => {
      expect(openPreflightPromptModal).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Noun' }),
      );
    });

    openPreflightPromptModal.mock.lastCall?.[0].onSubmit('dog');

    await vi.waitFor(() => {
      expect(lastWorker().posted).toContainEqual({ type: 'prompt:result', value: 'dog' });
    });

    lastWorker().emit({ type: 'result', env: { variables: {} }, headers: {}, pluginsState: {} });

    await expect(run).resolves.toMatchObject({ status: 'success' });
  });

  it('answers with null when the host wires no prompt modal', async () => {
    const { result } = mountPreflight();

    act(() => {
      void result.current.runPreflight();
    });

    lastWorker().emit({ type: 'prompt', title: 'Noun', defaultValue: undefined, options: {} });

    await vi.waitFor(() => {
      expect(lastWorker().posted).toContainEqual({ type: 'prompt:result', value: null });
    });
  });
});
