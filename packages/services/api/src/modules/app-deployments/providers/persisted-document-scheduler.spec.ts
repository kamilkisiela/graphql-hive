import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Logger } from '../../shared/providers/logger';
import type { BatchProcessEvent } from './persisted-document-ingester';
import { PersistedDocumentScheduler } from './persisted-document-scheduler';

const { FakeWorker, workers } = vi.hoisted(() => {
  class FakeWorker {
    static instances: Array<FakeWorker> = [];
    private listeners = new Map<string, Array<(data: unknown) => void>>();
    postMessage = vi.fn();

    constructor() {
      FakeWorker.instances.push(this);
    }

    on(event: string, listener: (data: unknown) => void) {
      this.listeners.set(event, [...(this.listeners.get(event) ?? []), listener]);
      return this;
    }

    emit(event: string, data?: unknown) {
      for (const listener of this.listeners.get(event) ?? []) {
        listener(data);
      }
    }
  }

  return { FakeWorker, workers: FakeWorker.instances };
});

vi.mock('node:worker_threads', () => ({ Worker: FakeWorker }));

const logger = {
  child: () => logger,
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
} as unknown as Logger;

const batchInput: BatchProcessEvent['data'] = {
  schemaSdl: 'type Query { hello: String }',
  targetId: 'target-id',
  appDeployment: { id: 'deployment-id', name: 'my-app', version: '1.0.0' },
  documents: [{ hash: 'hash-0', body: '{ hello }' }],
};

const emptyMetrics = {
  s3WriteMetrics: [],
  r2ErrorTraceSummary: { rayIds: [], statusCodes: [], totalCount: 0 },
};

function cancelMessages(worker: InstanceType<typeof FakeWorker>) {
  return worker.postMessage.mock.calls
    .map(([message]) => message as { event: string })
    .filter(message => message.event === 'CANCEL');
}

describe('PersistedDocumentScheduler cancellation', () => {
  beforeEach(() => {
    workers.length = 0;
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function start() {
    const scheduler = new PersistedDocumentScheduler(logger);
    const worker = workers[0];
    const controller = new AbortController();
    const batch = scheduler.processBatch(batchInput, controller.signal);
    const [processMessage] = worker.postMessage.mock.calls[0] as [{ event: string; id: string }];
    expect(processMessage.event).toBe('PROCESS');
    return { worker, controller, batch, id: processMessage.id };
  }

  it('resolves with the worker result', async () => {
    const { worker, batch, id } = start();

    worker.emit('message', {
      event: 'processedBatch',
      id,
      data: { type: 'success' },
      ...emptyMetrics,
    });

    await expect(batch).resolves.toEqual({ type: 'success' });
    expect(cancelMessages(worker)).toHaveLength(0);
  });

  it('cancels the worker batch and rejects when the client aborts', async () => {
    const { worker, controller, batch, id } = start();

    controller.abort();

    await expect(batch).rejects.toThrow('Request aborted by the client.');
    expect(worker.postMessage).toHaveBeenCalledWith({
      event: 'CANCEL',
      id,
      reason: 'Request aborted by the client.',
    });
  });

  it('cancels the worker batch and rejects when the batch times out', async () => {
    const { worker, controller, batch, id } = start();

    vi.advanceTimersByTime(50_000);

    await expect(batch).rejects.toThrow('Timeout, worker did not respond within time.');
    expect(worker.postMessage).toHaveBeenCalledWith({
      event: 'CANCEL',
      id,
      reason: 'Timeout, worker did not respond within time.',
    });

    controller.abort();
    await Promise.resolve();
    expect(cancelMessages(worker)).toHaveLength(1);
  });
});
