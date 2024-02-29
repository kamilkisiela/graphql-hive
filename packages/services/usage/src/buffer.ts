import { randomUUID } from 'crypto';
import type { ServiceLogger } from '@hive/service-common';

export class BufferTooBigError extends Error {
  constructor(public bytes: number) {
    super(`Buffer too big: ${bytes}`);
  }
}

export function isBufferTooBigError(error: unknown): error is BufferTooBigError {
  return error instanceof BufferTooBigError;
}

/**
 * @param totalLength Number of all items in a list
 * @param numOfChunks How many chunks to split the list into
 * @param chunkIndex The index of the chunk to split the list into (0-based)
 */
export function calculateChunkSize(
  totalLength: number,
  numOfChunks: number,
  chunkIndex: number,
): number {
  // If x % n == 0 then the minimum, difference is 0 and all numbers are x / n
  if (totalLength % numOfChunks == 0) {
    return totalLength / numOfChunks;
  }
  // upto n-(x % n) the values will be x / n
  // after that the values will be x / n + 1
  const zp = numOfChunks - (totalLength % numOfChunks);
  const pp = Math.floor(totalLength / numOfChunks);

  if (chunkIndex >= zp) {
    return pp + 1;
  }
  return pp;
}

export function createEstimator(config: {
  defaultBytesPerUnit: number;
  /**
   * Reset estimations after this many milliseconds.
   */
  resetAfter: number;
  /**
   * Increase the default bytes per operation by 0-1.
   */
  increaseBy: (info: { calls: number; overflows: number }) => number;
  logger: ServiceLogger;
}) {
  let calls = 0;
  let overflows = 0;
  let sumOfBytes = 0;
  let sumOfReportSizes = 0;
  let lastReset = Date.now();
  let defaultBytesPerUnit = config.defaultBytesPerUnit;

  function reset(increaseBy: number) {
    config.logger.info('Resetting buffer estimator');
    sumOfBytes = 0;
    sumOfReportSizes = 0;
    calls = 0;
    overflows = 0;
    lastReset = Date.now();

    if (increaseBy) {
      // increase the default estimation by X ratio
      // but don't go higher than 50% of original estimation
      defaultBytesPerUnit = Math.min(
        (1 + increaseBy) * defaultBytesPerUnit,
        1.5 * config.defaultBytesPerUnit,
      );
      config.logger.info(
        'Increasing default bytes per unit (ratio=%s, new=%s)',
        increaseBy,
        defaultBytesPerUnit,
      );
    }
  }

  return {
    getDefaultBytesPerUnit() {
      return defaultBytesPerUnit;
    },
    /**
     * Estimate the size in bytes based on the number of units
     */
    estimate(size: number) {
      if (sumOfBytes === 0 || sumOfReportSizes === 0) {
        return defaultBytesPerUnit * size;
      }

      return (sumOfBytes / sumOfReportSizes) * size;
    },
    /**
     * Increase the size of units and the size in bytes in the estimator.
     * It's needed for future estimations
     */
    teach({ bytes, operations }: { bytes: number; operations: number }) {
      calls++;
      sumOfBytes += bytes;
      sumOfReportSizes += operations;

      if (Date.now() - lastReset >= config.resetAfter) {
        config.logger.info('Estimator reached the reset time');
        reset(0);
      }
    },
    overflowed(batchId: string) {
      config.logger.info('Payload was most likely bigger than expected (id=%s)', batchId);
      overflows++;

      const increaseBy = config.increaseBy({
        calls,
        overflows,
      });

      if (increaseBy) {
        reset(increaseBy);
      }
    },
  };
}

export function createKVBuffer<T>(config: {
  logger: ServiceLogger;
  size: number;
  interval: number;
  limitInBytes: number;
  useEstimator: boolean;
  calculateReportSize(report: T): number;
  split(report: T, numOfChunks: number): readonly T[];
  onRetry(reports: readonly T[]): void;
  sender(
    reports: readonly T[],
    estimatedSizeInBytes: number,
    batchId: string,
    validateSize: (actualSizeInBytes: number) => void | never,
  ): Promise<void>;
}) {
  const { logger } = config;
  let buffer: T[] = [];
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const estimator = createEstimator({
    logger,
    defaultBytesPerUnit: config.limitInBytes / config.size,
    // Reset the estimator every 60s
    resetAfter: 60_000,
    increaseBy({ calls, overflows }) {
      if (calls > 100 && overflows / calls > 0.1) {
        return 0.05;
      }

      return 0;
    },
  });

  function calculateBufferSize(reports: readonly T[]) {
    return reports.reduce((sum, report) => sum + config.calculateReportSize(report), 0);
  }

  function calculateBufferSizeInBytes(reports: readonly T[]) {
    return estimator.estimate(calculateBufferSize(reports));
  }

  function sumOfOperationsSizeInBuffer() {
    return buffer.reduce((sum, report) => sum + (report as any).size, 0);
  }

  async function flushBuffer(
    reports: readonly T[],
    size: number,
    batchId: string,
    isRetry = false,
  ) {
    logger.info(`Flushing (reports=%s, bufferSize=%s, id=%s)`, reports.length, size, batchId);
    const estimatedSizeInBytes = estimator.estimate(size);
    buffer = [];
    await config
      .sender(reports, estimatedSizeInBytes, batchId, function validateSize(bytes) {
        if (!config.useEstimator) {
          return;
        }

        logger.info(
          `Estimator (predicted=%s, actual=%s, errorRatio=%s, default=%s, id=%s)`,
          estimatedSizeInBytes,
          bytes,
          (Math.abs(estimatedSizeInBytes - bytes) / bytes).toFixed(4),
          estimator.getDefaultBytesPerUnit(),
          batchId,
        );

        estimator.teach({
          operations: size,
          bytes,
        });

        if (bytes > config.limitInBytes) {
          estimator.overflowed(batchId);
          throw new BufferTooBigError(bytes);
        }
      })
      .catch(error => {
        if (!isRetry && isBufferTooBigError(error)) {
          config.onRetry(reports);
          logger.info(`Retrying (reports=%s, bufferSize=%s, id=%s)`, reports.length, size, batchId);

          const numOfChunks = Math.ceil(error.bytes / config.limitInBytes);

          // We split reports into chunks in case we have few big reports (or even single big report)
          const newReports: T[] = [];
          for (const report of reports) {
            newReports.push(...config.split(report, numOfChunks));
          }

          const chunks: T[][] = [];
          let endedAt = 0;
          for (let chunkIndex = 0; chunkIndex < numOfChunks; chunkIndex++) {
            const chunkSize = calculateChunkSize(newReports.length, numOfChunks, chunkIndex);
            const start = endedAt;
            const end = start + chunkSize;
            endedAt = end;
            chunks.push(newReports.slice(start, end));
          }

          return Promise.all(
            chunks.map((chunk, chunkIndex) =>
              flushBuffer(
                chunk,
                calculateBufferSize(chunk),
                batchId + '--retry-chunk-' + chunkIndex,
                true,
              ),
            ),
          );
        }

        return Promise.reject(error);
      });
  }

  async function send(shouldSchedule = true): Promise<void> {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }

    if (buffer.length !== 0) {
      const reports = buffer.slice();
      const size = calculateBufferSize(reports);
      const batchId = randomUUID();

      try {
        await flushBuffer(reports, size, batchId);
      } catch (error) {
        logger.error(error);
        // the payload size was most likely too big
        estimator.overflowed(batchId);
      }
    }

    if (shouldSchedule) {
      schedule();
    }
  }

  function schedule() {
    timeoutId = setTimeout(() => send(true), config.interval);
  }

  function add(report: T) {
    if (config.useEstimator) {
      const currentBufferSize = calculateBufferSizeInBytes(buffer);
      const estimatedReportSize = estimator.estimate(config.calculateReportSize(report));
      const estimatedBufferSize = currentBufferSize + estimatedReportSize;

      if (currentBufferSize >= config.limitInBytes || estimatedBufferSize >= config.limitInBytes) {
        void send(true);
      }

      if (estimatedReportSize > config.limitInBytes) {
        const numOfChunks = Math.ceil(estimatedReportSize / config.limitInBytes);
        const reports = config.split(report, numOfChunks);
        for (const report of reports) {
          add(report);
        }
      } else {
        buffer.push(report);
      }
    } else {
      buffer.push(report);
      if (sumOfOperationsSizeInBuffer() >= config.size) {
        void send(true);
      }
    }
  }

  return {
    add,
    start() {
      logger.info('Started buffer');
      schedule();
    },
    async stop() {
      logger.info('Stopping buffer');
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      await send(false);
    },
  };
}
