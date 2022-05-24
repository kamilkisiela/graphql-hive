import { createKVBuffer, calculateChunkSize } from '../src/buffer';

function waitFor(time: number) {
  return new Promise(resolve => setTimeout(resolve, time));
}

const eventHubLimitInBytes = 900_000;
const bufferSize = 1200;
const defaultBytesPerUnit = eventHubLimitInBytes / bufferSize;

test('increase the defaultBytesPerOperation estimation by 5% when over 100 calls were made and 10% of them failed', async () => {
  const logger = {
    // info: jest.fn(console.info),
    // error: jest.fn(console.error),
    info: jest.fn(),
    error: jest.fn(),
  };
  const flush = jest.fn();
  const onRetry = jest.fn();
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
    calculateReportSize(report) {
      return report.size;
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

  expect(logger.info).not.toHaveBeenCalledWith(expect.stringContaining('Increasing default bytes per unit'));

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

  expect(logger.info).not.toHaveBeenCalledWith(expect.stringContaining('Increasing default bytes per unit'));

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
    newDefault
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
    info: jest.fn(),
    error: jest.fn(),
  };
  const flush = jest.fn();
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
    calculateReportSize(report) {
      return report.size;
    },
    onRetry() {},
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

test('buffer create two chunks out of one buffer when actual buffer size is too big', async () => {
  const logger = {
    info: jest.fn(),
    error: jest.fn(),
    // info: jest.fn(console.info),
    // error: jest.fn(console.error),
  };
  const flush = jest.fn();
  const split = jest.fn((report, numOfChunks) => {
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
  const onRetry = jest.fn();
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
    calculateReportSize(report) {
      return report.size;
    },
    onRetry,
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
  expect(flush).toHaveBeenNthCalledWith(1, 'big-0', bufferSize / 2, expect.stringContaining('--retry-chunk-0'));
  expect(flush).toHaveBeenNthCalledWith(2, 'big-1', bufferSize / 2, expect.stringContaining('--retry-chunk-1'));

  await buffer.stop();
});
