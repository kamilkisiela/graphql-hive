import type { FastifyLoggerInstance } from '@hive/service-common';
import type { Writer } from './writer';
import {
  ingestedOperationsWrites,
  ingestedOperationsFailures,
  ingestedOperationRegistryWrites,
  ingestedOperationRegistryFailures,
  flushes,
  flushSize,
  flushOperationsSize,
  flushOperationCollectionSize,
} from './metrics';

const delimiter = Buffer.from('\n');

export function createBatcher(config: {
  logger: FastifyLoggerInstance;
  intervalInMS: number;
  limitInBytes: number;
  writer: Writer;
}) {
  const { logger, limitInBytes, intervalInMS, writer } = config;

  logger.info('Batching is enabled (interval=%s, limit=%s)', intervalInMS, limitInBytes);

  let lastFlushedAt = Date.now();
  // Total bytes in current batch
  // It has an underscore as it's meant to be private
  let _totalBytes = 0;
  // A list of buffers in current batch
  let operationsBuffers: Buffer[] = [];
  // A list of buffers in current batch
  let operationCollectionBuffers: Buffer[] = [];
  // A list of buffers in current batch
  let legacyOperationsBuffers: Buffer[] = [];
  // A list of buffers in current batch
  let legacyOperationCollectionBuffers: Buffer[] = [];
  // A set of pending writes
  const inFlight = new Set<Promise<void>>();

  let intervalId: ReturnType<typeof setInterval> | null = null;

  function getTotalBytes() {
    // We do the getter to makes sure we're always getting the latest value
    return _totalBytes;
  }

  function increaseTotalBytes(chunkBytes: number) {
    _totalBytes += chunkBytes;
  }

  function resetBatch() {
    _totalBytes = 0;
    operationsBuffers = [];
    operationCollectionBuffers = [];
    legacyOperationsBuffers = [];
    legacyOperationCollectionBuffers = [];
  }

  function drain() {
    // Why /2? Because we add a delimiter after each item
    const operationsLength = operationsBuffers.length / 2;
    const operationCollectionLength = operationCollectionBuffers.length / 2;

    // Remove the last delimiter in both
    operationsBuffers.pop();
    operationCollectionBuffers.pop();
    // legacy
    legacyOperationsBuffers.pop();
    legacyOperationCollectionBuffers.pop();

    const drained = {
      totalBytes: getTotalBytes(),
      operationsBuffers,
      operationsLength,
      operationCollectionBuffers,
      operationCollectionLength,
      // legacy
      legacyOperationsBuffers,
      legacyOperationCollectionBuffers,
    };

    resetBatch();

    return drained;
  }

  function checkIfFlushIsNeeded(): null | 'interval-time' | 'interval-size' {
    const bytes = getTotalBytes();

    if (bytes === 0) {
      return null;
    }

    const isTimeToFlush = Date.now() - lastFlushedAt >= intervalInMS;
    const isSizeToFlush = checkIfOversized(bytes);

    if (isTimeToFlush) {
      return 'interval-time';
    }

    if (isSizeToFlush) {
      return 'interval-size';
    }

    return null;
  }

  function checkIfOversized(expectedSizeInBytes: number) {
    return expectedSizeInBytes >= limitInBytes;
  }

  async function track(promise: Promise<void>) {
    inFlight.add(promise);

    try {
      return await promise;
    } finally {
      // Remove the promise from the set, but not before it's done done
      setImmediate(() => {
        inFlight.delete(promise);
      });
    }
  }

  async function flush(reason: string): Promise<void> {
    const drained = drain();
    logger.info('Flushing batched operations (bytes=%s, reason=%s)', drained.totalBytes, reason);

    flushes.inc({ reason });
    flushSize
      .labels({
        reason,
      })
      .observe(drained.totalBytes);
    flushOperationsSize.labels({ reason }).observe(drained.operationsLength);
    flushOperationCollectionSize
      .labels({
        reason,
      })
      .observe(drained.operationCollectionLength);

    lastFlushedAt = Date.now();

    await Promise.all([
      track(
        Promise.all([
          writer.writeOperations(drained.operationsBuffers),
          writer.legacy.writeOperations(drained.legacyOperationsBuffers),
        ])
          .then(async () => {
            ingestedOperationsWrites.inc(drained.operationsLength);
          })
          .catch(async error => {
            ingestedOperationsFailures.inc(drained.operationsLength);
            logger.error(error);
          })
      ),
      track(
        Promise.all([
          writer.writeRegistry(drained.operationCollectionBuffers),
          writer.legacy.writeRegistry(drained.legacyOperationCollectionBuffers),
        ])
          .then(async () => {
            ingestedOperationRegistryWrites.inc(drained.operationCollectionLength);
          })
          .catch(async error => {
            ingestedOperationRegistryFailures.inc(drained.operationCollectionLength);
            logger.error(error);
          })
      ),
    ]);
  }

  function add(serializedRowsPerTable: {
    operations: string[];
    operation_collection: string[];
    legacy: { operations: string[]; operation_collection: string[] };
  }) {
    let chunkBytes = 0;

    const operations = serializedRowsPerTable.operations
      .map(str => {
        const buff = Buffer.from(str);
        chunkBytes += buff.byteLength;
        return [buff, delimiter];
      })
      .flat(1);
    const operation_collection = serializedRowsPerTable.operation_collection
      .map(str => {
        const buff = Buffer.from(str);
        chunkBytes += buff.byteLength;
        return [buff, delimiter];
      })
      .flat(1);

    // legacy
    const legacy_operations = serializedRowsPerTable.legacy.operations
      .map(str => {
        const buff = Buffer.from(str);
        return [buff, delimiter];
      })
      .flat(1);
    const legacy_operation_collection = serializedRowsPerTable.legacy.operation_collection
      .map(str => {
        const buff = Buffer.from(str);
        return [buff, delimiter];
      })
      .flat(1);

    // check if buffer will be over the limit
    const bytesAfterAdd = getTotalBytes() + chunkBytes;

    if (getTotalBytes() > 0 && checkIfOversized(bytesAfterAdd)) {
      void flush('future-oversized');
    }

    for (const op of operations) {
      operationsBuffers.push(op);
    }

    for (const op of operation_collection) {
      operationCollectionBuffers.push(op);
    }

    for (const op of legacy_operations) {
      legacyOperationsBuffers.push(op);
    }

    for (const op of legacy_operation_collection) {
      legacyOperationCollectionBuffers.push(op);
    }

    increaseTotalBytes(chunkBytes);

    if (checkIfOversized(getTotalBytes())) {
      void flush('oversized');
    }
  }

  return {
    add,
    start() {
      logger.info('Started Batcher');

      intervalId = setInterval(() => {
        const reason = checkIfFlushIsNeeded();
        if (reason) {
          void flush(reason);
        }
      }, intervalInMS / 3);
    },
    async stop() {
      logger.info('Stopping Batcher');

      if (intervalId) {
        clearInterval(intervalId);
      }

      logger.info('Stopping pending writes (total=%s)', inFlight.size);

      await Promise.all(
        // Wait for all pending flushes to complete
        Array.from(inFlight).concat(
          // Flush if there is anything left
          getTotalBytes() > 0 ? flush('stop') : Promise.resolve()
        )
      );
    },
  };
}
