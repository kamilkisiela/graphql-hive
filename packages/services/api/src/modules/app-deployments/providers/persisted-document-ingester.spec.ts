import { describe, expect, it, vi } from 'vitest';
import { getErrorSource, type ServiceLogger } from '@hive/service-common';
import type { ClickHouse } from '../../operations/providers/clickhouse-client';
import type { S3Writer } from '../../shared/providers/s3-writer';
import { PersistedDocumentIngester } from './persisted-document-ingester';
import { PERSISTED_DOCUMENT_BATCH_TIMEOUT_MS } from './persisted-document-scheduler';

const batchInput = {
  schemaSdl: 'type Query { hello: String }',
  targetId: '5c3fd2b7-6c1b-4c0f-9f3d-0f1a2b3c4d5e',
  appDeployment: { id: 'deployment-id', name: 'my-app', version: '1.0.0' },
  documents: Array.from({ length: 40 }, (_, index) => ({
    hash: `hash-${index}`,
    body: `query Q${index} { hello }`,
  })),
};

type PendingPut = {
  signal: AbortSignal | undefined;
  resolve: () => void;
  reject: (error: unknown) => void;
};

function createFakes() {
  const puts: Array<PendingPut> = [];
  const insertSignals: Array<AbortSignal | undefined> = [];

  const s3 = {
    writeConcurrently: vi.fn(
      (_key: string, _operation: string, init: { signal?: AbortSignal }) =>
        new Promise<Array<{ statusCode: number; url: string }>>((resolve, reject) => {
          puts.push({
            signal: init.signal,
            resolve: () => resolve([{ statusCode: 200, url: 'https://primary.example.com/x' }]),
            reject,
          });
        }),
    ),
  };

  const clickhouse = {
    insert: vi.fn(async (args: { signal?: AbortSignal }) => {
      insertSignals.push(args.signal);
    }),
  };

  const logger = {
    child: () => logger,
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  const ingester = new PersistedDocumentIngester(
    clickhouse as unknown as ClickHouse,
    s3 as unknown as S3Writer,
    logger as unknown as ServiceLogger,
  );

  return { ingester, puts, insertSignals };
}

const tick = () => new Promise<void>(resolve => setImmediate(resolve));

describe('PersistedDocumentIngester cancellation', () => {
  it('stops every storage request of the batch when the signal aborts', async () => {
    const { ingester, puts, insertSignals } = createFakes();
    const controller = new AbortController();

    const batch = ingester.processBatch(batchInput, controller.signal);
    await tick();

    expect(puts).toHaveLength(30);

    const reason = new Error('client went away');
    controller.abort(reason);

    await expect(batch).rejects.toBe(reason);
    await tick();

    expect(puts).toHaveLength(30);

    const signals = new Set([...puts.map(put => put.signal), ...insertSignals]);
    expect(signals.size).toBe(1);
    const [sharedSignal] = signals;
    expect(sharedSignal?.aborted).toBe(true);
  });

  it('aborts the sibling requests when one storage write fails', async () => {
    const { ingester, puts } = createFakes();
    const controller = new AbortController();

    const batch = ingester.processBatch(batchInput, controller.signal);
    await tick();

    const failure = new Error('PUT failed');
    puts[3].reject(failure);

    await expect(batch).rejects.toBe(failure);
    await tick();

    expect(puts).toHaveLength(30);
    expect(puts[0].signal?.aborted).toBe(true);
    expect(controller.signal.aborted).toBe(false);
  });
});

const preprocessedInput = {
  targetId: batchInput.targetId,
  appDeployment: batchInput.appDeployment,
  documents: batchInput.documents.map(document => ({
    ...document,
    operationName: null,
    schemaCoordinates: ['Query.hello'],
    insightsHash: document.hash,
  })),
};

describe('PersistedDocumentIngester deadline', () => {
  it('bounds a preprocessed batch by the batch timeout', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      const { ingester, puts, insertSignals } = createFakes();

      const batch = ingester.processPreprocessedBatch(
        preprocessedInput,
        new AbortController().signal,
      );
      await tick();
      expect(puts).toHaveLength(30);

      vi.advanceTimersByTime(PERSISTED_DOCUMENT_BATCH_TIMEOUT_MS);

      await expect(batch).rejects.toMatchObject({ name: 'TimeoutError' });
      expect(getErrorSource(await batch.catch(error => error))).toBe('persisted-document-ingester');
      expect(puts[0].signal?.aborted).toBe(true);
      expect(insertSignals[0]?.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
