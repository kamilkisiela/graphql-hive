import path from 'node:path';
import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'url';
import { Injectable, Scope } from 'graphql-modules';
import { Logger } from '../../shared/providers/logger';
import { BatchProcessedEvent, BatchProcessEvent } from './persisted-document-ingester';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class PersistedDocumentScheduler {
  private logger: Logger;
  private workers: Array<Worker>;
  private cache = new Map<string, (data: BatchProcessedEvent) => void>();

  createWorker(index: number) {
    const name = `persisted-documents-worker-${index}`;
    const worker = new Worker(path.join(__dirname, 'persisted-documents-worker.js'), {
      name,
    });

    worker.on('error', error => {
      console.log(name, 'Worker error', { error });
    });

    worker.on('message', (data: BatchProcessedEvent) => {
      console.log(name, 'received message', data.id, data.event);
      if (data.event === 'PROCESSED') {
        this.cache.get(data.id)?.(data);
        this.cache.delete(data.id);
      }
    });

    return worker;
  }

  getRandomWorker() {
    return this.workers[Math.floor(Math.random() * this.workers.length)];
  }

  constructor(logger: Logger) {
    this.logger = logger.child({ source: 'PersistedDocumentScheduler' });
    this.workers = Array.from({ length: 4 }, (_, i) => this.createWorker(i));
  }

  async processBatch(data: BatchProcessEvent['data']) {
    const id = crypto.randomUUID();
    const d = createDeferred<BatchProcessedEvent>();

    const timeout = setTimeout(() => {
      this.cache.delete(id);
      d.reject(new Error('Timeout.'));
    }, 20_000);

    this.cache.set(id, data => {
      clearTimeout(timeout);
      d.resolve(data);
    });

    const time = process.hrtime();

    this.getRandomWorker().postMessage({
      event: 'PROCESS',
      id,
      data,
    });

    const result = await d.promise;

    const endTime = process.hrtime(time);
    console.log('Time taken: %ds %dms', endTime[0], endTime[1] / 1000000);

    return result.data;
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
