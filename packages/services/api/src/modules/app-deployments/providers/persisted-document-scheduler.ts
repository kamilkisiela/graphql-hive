import path from 'node:path';
import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'url';
import { Injectable, Scope } from 'graphql-modules';
import { LogLevel } from 'graphql-yoga';
import { Logger } from '../../shared/providers/logger';
import { BatchProcessedEvent, BatchProcessEvent } from './persisted-document-ingester';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

type PendingTaskRecord = {
  resolve: (data: BatchProcessedEvent) => void;
  reject: (err: unknown) => void;
};

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class PersistedDocumentScheduler {
  private logger: Logger;
  private workers: Array<
    (input: BatchProcessEvent['data']) => Promise<BatchProcessedEvent['data']>
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
      console.error(error);
      this.logger.error('Worker error %s', error);
    });

    worker.on('exit', code => {
      this.logger.error('Worker stopped with exit code %s', String(code));
      if (code === 0) {
        return;
      }

      this.logger.debug('Re-Creating worker %s', index);

      for (const [, task] of tasks) {
        task.reject(new Error('Worker stopped.'));
      }

      this.workers[index] = this.createWorker(index);
    });

    worker.on(
      'message',
      (
        data:
          | BatchProcessedEvent
          | { event: 'error'; id: string; err: Error }
          | {
              event: 'log';
              bindings: Record<string, unknown>;
              level: LogLevel;
              args: [string, ...unknown[]];
            },
      ) => {
        if (data.event === 'log') {
          this.logger.child(data.bindings)[data.level](...data.args);
          return;
        }

        if (data.event === 'error') {
          tasks.get(data.id)?.reject(data.err);
        }

        if (data.event === 'processedBatch') {
          tasks.get(data.id)?.resolve(data);
        }
      },
    );

    const { logger } = this;

    return async function batchProcess(data: BatchProcessEvent['data']) {
      const id = crypto.randomUUID();
      const d = createDeferred<BatchProcessedEvent>();
      const timeout = setTimeout(() => {
        task.reject(new Error('Timeout, worker did not respond within time.'));
      }, 20_000);

      const task: PendingTaskRecord = {
        resolve: data => {
          tasks.delete(id);
          clearTimeout(timeout);
          d.resolve(data);
        },
        reject: err => {
          tasks.delete(id);
          clearTimeout(timeout);
          d.reject(err);
        },
      };

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

  async processBatch(data: BatchProcessEvent['data']) {
    return this.getRandomWorker()(data);
  }
}

function createDeferred<T = void>() {
  let resolve: (value: T) => void;
  let reject: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return {
    resolve: (value: T) => resolve(value),
    reject: (error: unknown) => reject(error),
    promise,
  };
}
