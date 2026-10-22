import { calculateChunkSize, createKVBuffer } from '../src/buffer';

function waitFor(time: number) {
  return new Promise(resolve => setTimeout(resolve, time));
}

const eventHubLimitInBytes = 900_000;
const bufferSize = 1200;
const defaultBytesPerUnit = eventHubLimitInBytes / bufferSize;

test('increase the defaultBytesPerOperation estimation by 5% when over 100 calls were made and 10% of them failed', async () => {
  const logger = {
    // info: vi.fn(console.info),
    // error: vi.fn(console.error),
    info: vi.fn(),
    error: vi.fn(),
  };
  const flush = vi.fn();
  const onRetry = vi.fn();
  const interval = 200;
  const size = {
    successful: bufferSize / 2,
    overflow: bufferSize,
    error: bufferSize / 2 - 1,
  };
  const bytesPerUnit = eventHubLimitInBytes / size.successful;
  const buffer = createKVBuffer<{
    id: string;
    size: number;
  }>({
    logger: logger as any,
    size: size.successful,
    interval,
    limitInBytes: eventHubLimitInBytes,
    useEstimator: true,
    onRetry,
    onDrop: vi.fn(),
    isTooLargePayloadError() {
      return true;
    },
    calculateReportSize(report) {
      return report.size;
    },
    isSplittable(report) {
      return report.size > 1;
    },
    split(report, numOfChunks) {
      const reports: Array<{
        id: string;
        size: number;
      }> = [];
      for (let chunkIndex = 0; chunkIndex < numOfChunks; chunkIndex++) {
        reports.push({
          id: `${report.id}-chunk-${chunkIndex}`,
          size: calculateChunkSize(report.size, numOfChunks, chunkIndex),
        });
      }
      return reports;
    },
    async sender(reports, _bytes, _batchId, validateSize) {
      const receivedSize = reports.reduce((sum, report) => report.size + sum, 0);
      flush(reports.map(r => r.id).join(','));
      if (receivedSize === size.error) {
        validateSize(size.error * bytesPerUnit);
        throw new Error('Over the size limit!');
      } else {
        validateSize(receivedSize * bytesPerUnit);
      }
    },
  });

  buffer.start();

  // make 100 calls
  for (let i = 0; i < 100; i++) {
    buffer.add({
      id: `good - ${i}`,
      size: size.successful,
    });
  }

  // Interval passes
  await waitFor(interval + 50);

  expect(logger.info).not.toHaveBeenCalledWith(
    expect.stringContaining('Increasing default bytes per unit'),
  );

  expect(flush).toBeCalledTimes(100);

  // make 10 calls that fail
  for (let i = 0; i < 12; i++) {
    buffer.add({
      id: `bad - ${i}`,
      size: size.error,
    });
  }

  // Interval passes
  await waitFor(interval + 50);

  expect(flush).toBeCalledTimes(112);

  expect(logger.info).not.toHaveBeenCalledWith(
    expect.stringContaining('Increasing default bytes per unit'),
  );

  await waitFor(1000);

  // make 1 call that fails
  buffer.add({
    id: 'decider',
    size: size.error,
  });

  // Interval passes
  await waitFor(interval + 50);

  const newDefault = bytesPerUnit * 1.05;
  expect(logger.info).toHaveBeenCalledWith(
    expect.stringContaining('Increasing default bytes per unit (ratio=%s, new=%s)'),
    0.05,
    newDefault,
  );
  const flushedTimes = 114;
  expect(flush).toHaveBeenCalledTimes(flushedTimes);

  // Buffer should split into two reports because the defaultBytesPerUnit estimation is increased
  // which means that the buffer can hold less operations than before
  buffer.add({
    id: 'new-reality',
    size: Math.ceil(eventHubLimitInBytes / newDefault) + 1,
  });
  // We reached the limit of bytes (according to the new estimations)
  // No need to wait for the interval to pass
  await waitFor(interval + 50);
  expect(flush).toHaveBeenCalledTimes(flushedTimes + 1);

  await buffer.stop();
  expect(flush).toHaveBeenCalledTimes(flushedTimes + 1);
});

test('buffer should split the report into multiple reports when the estimated size is greater than the limit', async () => {
  const logger = {
    info: vi.fn(),
    error: vi.fn(),
  };
  const flush = vi.fn();
  const interval = 200;
  const buffer = createKVBuffer<{
    id: string;
    size: number;
    operations: number[];
  }>({
    logger: logger as any,
    size: bufferSize,
    interval,
    limitInBytes: eventHubLimitInBytes,
    useEstimator: true,
    isTooLargePayloadError() {
      return true;
    },
    calculateReportSize(report) {
      return report.size;
    },
    isSplittable(report) {
      return report.size > 1;
    },
    onRetry() {},
    onDrop: vi.fn(),
    split(report, numOfChunks) {
      const reports: Array<{
        id: string;
        size: number;
        operations: number[];
      }> = [];
      let endedAt = 0;
      for (let i = 0; i < numOfChunks; i++) {
        const chunkSize = calculateChunkSize(report.size, numOfChunks, i);
        const start = endedAt;
        const end = start + chunkSize;
        endedAt = end;

        const operations = report.operations.slice(start, end);
        reports.push({
          id: `${report.id}-${i}`,
          size: operations.length,
          operations,
        });
      }

      return reports;
    },
    async sender(reports, _bytes, _batchId, validateSize) {
      const receivedSize = reports.reduce((sum, report) => report.size + sum, 0);
      flush(reports.map(r => r.id).join(','), receivedSize);
      validateSize(receivedSize * defaultBytesPerUnit);
    },
  });

  buffer.start();

  const bigBatchSize = bufferSize + 20;
  // add a report bigger than the limit
  buffer.add({
    id: 'big',
    size: bigBatchSize,
    operations: new Array(bigBatchSize).fill(0).map((_, i) => i),
  });

  // Interval passes
  await waitFor(interval + 50);

  // Buffer should flush two reports, the big report splitted in half
  expect(flush).toHaveBeenNthCalledWith(1, 'big-0', bigBatchSize / 2);
  expect(flush).toHaveBeenNthCalledWith(2, 'big-1', bigBatchSize / 2);

  const biggerBatchSize = bufferSize + bufferSize + 30;
  buffer.add({
    id: 'bigger',
    size: biggerBatchSize,
    operations: new Array(biggerBatchSize).fill(0).map((_, i) => i),
  });

  // Interval passes
  await waitFor(interval + 50);

  expect(flush).toHaveBeenNthCalledWith(3, 'bigger-0', biggerBatchSize / 3);
  expect(flush).toHaveBeenNthCalledWith(4, 'bigger-1', biggerBatchSize / 3);
  expect(flush).toHaveBeenNthCalledWith(5, 'bigger-2', biggerBatchSize / 3);

  await buffer.stop();
});

test('buffer drops a report immediately when it cannot be split any smaller', async () => {
  const split = vi.fn((report: { size: number }) => [report]);
  const onDrop = vi.fn();
  const buffer = createKVBuffer<{ size: number }>({
    logger: { info: vi.fn(), error: vi.fn() } as any,
    size: 1,
    interval: 60_000,
    limitInBytes: 100,
    useEstimator: true,
    calculateReportSize: report => report.size,
    // Simulates a report that is already at the irreducible floor (e.g. a single
    // operation shape) - splitting it further would be a no-op.
    isSplittable: () => false,
    split,
    onRetry: vi.fn(),
    onDrop,
    isTooLargePayloadError() {
      return false;
    },
    async sender(reports, _bytes, _batchId, validateSize) {
      validateSize(reports.reduce((sum, report) => sum + report.size, 0) * 200);
    },
  });

  buffer.add({ size: 1 });
  await buffer.stop();

  expect(split).not.toHaveBeenCalled();
  expect(onDrop).toHaveBeenCalledTimes(1);
});

test('buffer keeps splitting across multiple rounds until every piece fits or is irreducible', async () => {
  const split = vi.fn((report: { id: string; size: number }, numOfChunks: number) => {
    const pieces: Array<{ id: string; size: number }> = [];
    for (let i = 0; i < numOfChunks; i++) {
      pieces.push({
        id: `${report.id}-${i}`,
        size: calculateChunkSize(report.size, numOfChunks, i),
      });
    }
    return pieces;
  });
  const onDrop = vi.fn();
  const buffer = createKVBuffer<{ id: string; size: number }>({
    logger: { info: vi.fn(), error: vi.fn() } as any,
    size: 10,
    interval: 60_000,
    limitInBytes: 100,
    useEstimator: true,
    calculateReportSize: report => report.size,
    isSplittable: report => report.size > 1,
    split,
    onRetry: vi.fn(),
    onDrop,
    isTooLargePayloadError() {
      return false;
    },
    async sender(reports, _estimatedBytes, _batchId, validateSize) {
      const totalSize = reports.reduce((sum, report) => sum + report.size, 0);
      // Only a group whose total size has been reduced to 1 fits; anything bigger
      // reports as oversized, forcing another round of splitting.
      validateSize(totalSize > 1 ? totalSize * 60 : 50);
    },
  });

  buffer.add({ id: 'root', size: 10 });
  await buffer.stop();

  // 1 top-level split (10 -> 6 pieces of size 1/1/2/2/2/2) plus a second round for
  // each size-2 piece that is still oversized (4 more splits) - more than one round.
  expect(split.mock.calls.length).toBeGreaterThan(1);
  expect(onDrop).not.toHaveBeenCalled();
});

test('buffer redistributes whole reports before splitting any individual report internals', async () => {
  const split = vi.fn((report: { id: string; size: number }) => [report]);
  const onDrop = vi.fn();
  const buffer = createKVBuffer<{ id: string; size: number }>({
    logger: { info: vi.fn(), error: vi.fn() } as any,
    size: 100,
    interval: 60_000,
    limitInBytes: 100,
    useEstimator: true,
    calculateReportSize: report => report.size,
    isSplittable: report => report.size > 1,
    split,
    onRetry: vi.fn(),
    onDrop,
    isTooLargePayloadError() {
      return false;
    },
    async sender(reports, _estimatedBytes, _batchId, validateSize) {
      const totalSize = reports.reduce((sum, report) => sum + report.size, 0);
      validateSize(totalSize > 1 ? totalSize * 60 : 50);
    },
  });

  buffer.add({ id: 'a', size: 1 });
  buffer.add({ id: 'b', size: 1 });
  buffer.add({ id: 'c', size: 1 });
  await buffer.stop();

  // Redistributing the 3 whole reports into smaller groups resolves the overflow -
  // no individual report ever needs its internals split.
  expect(split).not.toHaveBeenCalled();
  expect(onDrop).not.toHaveBeenCalled();
});

test('buffer skips empty groups when redistributing more chunks than reports', async () => {
  const sender = vi.fn(
    async (
      reports: readonly { id: string; size: number }[],
      _estimatedBytes: number,
      _batchId: string,
      validateSize: (bytes: number) => void,
    ) => {
      validateSize(reports.length > 1 ? 500 : 50);
    },
  );
  const onDrop = vi.fn();
  const buffer = createKVBuffer<{ id: string; size: number }>({
    logger: { info: vi.fn(), error: vi.fn() } as any,
    size: 100,
    interval: 60_000,
    limitInBytes: 100,
    useEstimator: true,
    calculateReportSize: () => 1,
    isSplittable: () => false,
    split: report => [report],
    onRetry: vi.fn(),
    onDrop,
    isTooLargePayloadError() {
      return false;
    },
    sender,
  });

  buffer.add({ id: 'a', size: 1 });
  buffer.add({ id: 'b', size: 1 });
  await buffer.stop();

  // 1 initial (oversized) call + exactly the non-empty retry groups - never a call
  // with an empty array, even though numOfChunks (5) exceeds the report count (2).
  expect(sender).toHaveBeenCalledTimes(3);
  for (const call of sender.mock.calls) {
    expect(call[0].length).toBeGreaterThan(0);
  }
  expect(onDrop).not.toHaveBeenCalled();
});

test('buffer isolates a disproportionately large report via regrouping before splitting its internals', async () => {
  const split = vi.fn((report: { id: string; size: number }, numOfChunks: number) => {
    const pieces: Array<{ id: string; size: number }> = [];
    for (let i = 0; i < numOfChunks; i++) {
      pieces.push({
        id: `${report.id}-${i}`,
        size: calculateChunkSize(report.size, numOfChunks, i),
      });
    }
    return pieces;
  });
  const onDrop = vi.fn();
  const buffer = createKVBuffer<{ id: string; size: number }>({
    logger: { info: vi.fn(), error: vi.fn() } as any,
    size: 100,
    interval: 60_000,
    limitInBytes: 100,
    useEstimator: true,
    calculateReportSize: report => report.size,
    isSplittable: report => report.size > 1,
    split,
    onRetry: vi.fn(),
    onDrop,
    isTooLargePayloadError() {
      return false;
    },
    async sender(reports, _estimatedBytes, _batchId, validateSize) {
      const totalSize = reports.reduce((sum, report) => sum + report.size, 0);
      validateSize(totalSize > 1 ? totalSize * 60 : 50);
    },
  });

  buffer.add({ id: 'small', size: 1 });
  buffer.add({ id: 'big', size: 10 });
  await buffer.stop();

  // The small report is isolated by whole-report regrouping and never touched by
  // split; only the big report, once alone and still oversized, gets split.
  expect(split.mock.calls.length).toBeGreaterThan(0);
  expect(split.mock.calls.some(call => call[0].id === 'small')).toBe(false);
  expect(onDrop).not.toHaveBeenCalled();
});

test('buffer create two chunks out of one buffer when actual buffer size is too big', async () => {
  const logger = {
    info: vi.fn(),
    error: vi.fn(),
    // info: vi.fn(console.info),
    // error: vi.fn(console.error),
  };
  const flush = vi.fn();
  const split = vi.fn((report, numOfChunks) => {
    const reports: Array<{
      id: string;
      size: number;
      operations: number[];
    }> = [];
    let endedAt = 0;
    for (let i = 0; i < numOfChunks; i++) {
      const chunkSize = calculateChunkSize(report.size, numOfChunks, i);
      const start = endedAt;
      const end = start + chunkSize;
      endedAt = end;

      const operations = report.operations.slice(start, end);
      reports.push({
        id: `${report.id}-${i}`,
        size: operations.length,
        operations,
      });
    }

    return reports;
  });
  const onRetry = vi.fn();
  const interval = 200;

  const buffer = createKVBuffer<{
    id: string;
    size: number;
    operations: number[];
  }>({
    logger: logger as any,
    size: bufferSize,
    interval,
    limitInBytes: eventHubLimitInBytes,
    useEstimator: true,
    isTooLargePayloadError() {
      return true;
    },
    calculateReportSize(report) {
      return report.size;
    },
    isSplittable(report) {
      return report.size > 1;
    },
    onRetry,
    onDrop: vi.fn(),
    split,
    async sender(reports, _bytes, batchId, validateSize) {
      const receivedSize = reports.reduce((sum, report) => report.size + sum, 0);
      validateSize(receivedSize * 2 * defaultBytesPerUnit);
      flush(reports.map(r => r.id).join(','), receivedSize, batchId);
    },
  });

  buffer.start();

  // add a report bigger than the limit
  buffer.add({
    id: 'big',
    size: bufferSize,
    operations: new Array(bufferSize).fill(0).map((_, i) => i),
  });

  // Interval passes
  await waitFor(interval + 50);

  // Reports should be split as well, just in case we have one or few big reports.
  // In our case it should be called once (1 report split into 2 reports)
  expect(split).toHaveBeenCalledTimes(1);
  // Flush should be retried because the buffer size was too big (twice as big)
  expect(onRetry).toBeCalledTimes(1);
  // Buffer should flush two reports, the big report splitted in half
  expect(flush).toHaveBeenNthCalledWith(
    1,
    'big-0',
    bufferSize / 2,
    expect.stringContaining('--retry-chunk-0'),
  );
  expect(flush).toHaveBeenNthCalledWith(
    2,
    'big-1',
    bufferSize / 2,
    expect.stringContaining('--retry-chunk-1'),
  );

  await buffer.stop();
});
