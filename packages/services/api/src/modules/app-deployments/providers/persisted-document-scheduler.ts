import path from 'node:path';
import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'url';
import { Injectable, Scope } from 'graphql-modules';
import { getErrorSource, setErrorSource, traceFn } from '@hive/service-common';
import { Logger, registerWorkerLogging } from '../../shared/providers/logger';
import {
  observeR2ErrorTrace,
  observeS3Write,
  R2ErrorTraceSummary,
  S3WriteMetric,
} from '../../shared/providers/s3-writer';
import {
  type BatchCancelEvent,
  type BatchProcessedEvent,
  type BatchProcessEvent,
  type BatchProcessingErrorEvent,
} from './persisted-document-ingester';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** How long a batch may take before the scheduler cancels it in the worker and fails the request. */
export const PERSISTED_DOCUMENT_BATCH_TIMEOUT_MS = 50_000;

type PendingTaskRecord = {
  resolve: (data: BatchProcessedEvent) => void;
  reject: (err: unknown) => void;
  onMetrics: (metrics: {
    s3WriteMetrics?: S3WriteMetric[];
    r2ErrorTraceSummary?: R2ErrorTraceSummary;
  }) => void;
};

export type SerializedWorkerError = {
  name: string;
  message: string;
  stack: string | undefined;
  source: string | null;
};

export function serializeWorkerError(error: unknown): SerializedWorkerError {
  const normalizedError = error instanceof Error ? error : new Error(String(error));
  return {
    name: normalizedError.name,
    message: normalizedError.message,
    stack: normalizedError.stack,
    source: getErrorSource(normalizedError),
  };
}

export function deserializeWorkerError(error: SerializedWorkerError): Error {
  const deserializedError = new Error(error.message);
  deserializedError.name = error.name;
  deserializedError.stack = error.stack;
  return error.source ? setErrorSource(deserializedError, error.source) : deserializedError;
}

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class PersistedDocumentScheduler {
  private logger: Logger;
  private workers: Array<
    (input: BatchProcessEvent['data'], signal: AbortSignal) => Promise<BatchProcessedEvent['data']>
  >;

  constructor(logger: Logger) {
    this.logger = logger.child({ source: 'PersistedDocumentScheduler' });
    this.workers = Array.from({ length: 4 }, (_, i) => this.createWorker(i));
  }

  private createWorker(index: number) {
    this.logger.debug('Creating worker %s', index);
    const name = `persisted-documents-worker-${index}`;
    const worker = new Worker(path.join(__dirname, 'persisted-documents-worker.js'), {
      name,
    });
    const tasks = new Map<string, PendingTaskRecord>();

    worker.on('error', error => {
      const errorText =
        error instanceof Error
          ? error.toString()
          : typeof error === 'string'
            ? error
            : JSON.stringify(error);
      this.logger.error('Worker error (error=%s)', errorText);
    });

    worker.on('exit', code => {
      this.logger.error('Worker stopped with exit code %s', String(code));
      if (code === 0) {
        return;
      }

      this.logger.debug('Re-Creating worker %s', index);
      this.workers[index] = this.createWorker(index);

      this.logger.debug('Cancel pending tasks %s', index);
      for (const [, task] of tasks) {
        task.reject(setErrorSource(new Error('Worker stopped.'), 'persisted-documents-worker'));
      }
    });

    registerWorkerLogging(this.logger, worker, name);

    worker.on('message', (data: BatchProcessedEvent | BatchProcessingErrorEvent) => {
      const task = tasks.get(data.id);

      if (!task) {
        return;
      }

      task.onMetrics({
        s3WriteMetrics: data.s3WriteMetrics,
        r2ErrorTraceSummary: data.r2ErrorTraceSummary,
      });

      if (data.event === 'error') {
        task.reject(deserializeWorkerError(data.error));
      }

      if (data.event === 'processedBatch') {
        task.resolve(data);
      }
    });

    const { logger } = this;

    return async function batchProcess(data: BatchProcessEvent['data'], signal: AbortSignal) {
      const abortedByClient = () =>
        setErrorSource(new Error('Request aborted by the client.'), 'client');

      if (signal.aborted) {
        throw abortedByClient();
      }

      const id = crypto.randomUUID();
      const d = Promise.withResolvers<BatchProcessedEvent>();
      let timeout: ReturnType<typeof setTimeout> | undefined;

      const cleanup = () => {
        clearTimeout(timeout);
        signal.removeEventListener('abort', onAbort);
      };

      /**
       * Fails the caller right away and tells the worker to stop the batch.
       * The record stays in `tasks` so the worker's final message can still report the metrics of
       * the cancelled batch; it is removed once that message arrives (or the worker exits).
       */
      const cancel = (reason: Error) => {
        worker.postMessage({
          event: 'CANCEL',
          id,
          reason: reason.message,
        } satisfies BatchCancelEvent);
        cleanup();
        d.reject(reason);
      };

      const onAbort = () => cancel(abortedByClient());

      timeout = setTimeout(() => {
        cancel(
          setErrorSource(
            new Error('Timeout, worker did not respond within time.'),
            'persisted-documents-worker',
          ),
        );
      }, PERSISTED_DOCUMENT_BATCH_TIMEOUT_MS);

      const task: PendingTaskRecord = {
        resolve: data => {
          tasks.delete(id);
          cleanup();
          d.resolve(data);
        },
        reject: err => {
          tasks.delete(id);
          cleanup();
          d.reject(err);
        },
        onMetrics(data) {
          if (data.s3WriteMetrics) {
            for (const metric of data.s3WriteMetrics) {
              observeS3Write(metric);
            }
          }

          if (data.r2ErrorTraceSummary) {
            observeR2ErrorTrace(data.r2ErrorTraceSummary);
          }
        },
      };

      signal.addEventListener('abort', onAbort, { once: true });
      tasks.set(id, task);
      const time = process.hrtime();

      worker.postMessage({
        event: 'PROCESS',
        id,
        data,
      });

      const result = await d.promise.finally(() => {
        const endTime = process.hrtime(time);
        logger.debug('Time taken: %ds %dms', endTime[0], endTime[1] / 1000000);
      });

      return result.data;
    };
  }

  private getRandomWorker() {
    return this.workers[Math.floor(Math.random() * this.workers.length)];
  }

  @traceFn('PersistedDocumentScheduler.processBatch', {
    initAttributes: (data, _) => ({
      'hive.target.id': data.targetId,
      'hive.appDeployment.documentCount': data.documents.length,
      'hive.appDeployment.id': data.appDeployment.id,
      'hive.appDeployment.version': data.appDeployment.version,
    }),
  })
  async processBatch(data: BatchProcessEvent['data'], signal: AbortSignal) {
    return this.getRandomWorker()(data, signal);
  }
}
