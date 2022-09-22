import { FastifyLoggerInstance } from '@hive/service-common';
import { createBatcher } from '../src/batcher';

async function waitFor(time: number) {
  await new Promise(resolve => setTimeout(resolve, time));
}

function mockWriter(fn?: () => Promise<void>) {
  const spies = {
    writeOperations: jest.fn(),
    writeRegistry: jest.fn(),
  };

  const writeOperations = async (buffers: Buffer[]) => {
    spies.writeOperations(Buffer.concat(buffers));

    if (fn) {
      return fn();
    }
  };

  const writeRegistry = async (buffers: Buffer[]) => {
    spies.writeRegistry(Buffer.concat(buffers));

    if (fn) {
      return fn();
    }
  };

  return {
    writeOperations,
    writeRegistry,
    spies,
    destroy() {},
  };
}

function mockLogger(): FastifyLoggerInstance {
  const spies: Record<keyof FastifyLoggerInstance, jest.Mock<any, any>> = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
    fatal: jest.fn(),
    child: jest.fn(() => {
      throw new Error('No mock available for logger.child');
    }),
  };

  return spies;
}

test('flush when time limit is reached', async () => {
  const writer = mockWriter();

  const batcher = createBatcher({
    logger: mockLogger(),
    intervalInMS: 200,
    limitInBytes: 1000,
    writer,
  });

  batcher.start();

  batcher.add({
    operations: ['a', 'b', 'c'],
    operation_collection: ['d', 'e', 'f'],
  });

  expect(writer.spies.writeOperations).not.toHaveBeenCalled();
  expect(writer.spies.writeRegistry).not.toHaveBeenCalled();

  await waitFor(300);

  expect(writer.spies.writeOperations).toHaveBeenCalledTimes(1);
  expect(writer.spies.writeRegistry).toHaveBeenCalledTimes(1);

  await batcher.stop();
});

test('flush when size limit is reached', async () => {
  const writer = mockWriter();

  const batcher = createBatcher({
    logger: mockLogger(),
    intervalInMS: 200,
    limitInBytes: 1,
    writer,
  });

  batcher.start();

  batcher.add({
    operations: ['a', 'b', 'c'],
    operation_collection: ['d', 'e', 'f'],
  });

  expect(writer.spies.writeOperations).toHaveBeenCalledTimes(1);
  expect(writer.spies.writeRegistry).toHaveBeenCalledTimes(1);

  await batcher.stop();
});

test('flush current batch when new addition makes it over the limit', async () => {
  const writer = mockWriter();

  const batcher = createBatcher({
    logger: mockLogger(),
    intervalInMS: 200,
    limitInBytes: 3,
    writer,
  });

  batcher.start();

  batcher.add({
    operations: ['a'],
    operation_collection: ['b'],
  });

  expect(writer.spies.writeOperations).not.toHaveBeenCalled();
  expect(writer.spies.writeRegistry).not.toHaveBeenCalled();

  batcher.add({
    operations: ['c'],
    operation_collection: ['d'],
  });

  expect(writer.spies.writeOperations).toHaveBeenCalledTimes(1);
  expect(writer.spies.writeRegistry).toHaveBeenCalledTimes(1);
  expect(writer.spies.writeOperations).toHaveBeenCalledWith(Buffer.from('a'));
  expect(writer.spies.writeRegistry).toHaveBeenCalledWith(Buffer.from('b'));

  await waitFor(400);

  expect(writer.spies.writeOperations).toHaveBeenCalledTimes(2);
  expect(writer.spies.writeRegistry).toHaveBeenCalledTimes(2);
  expect(writer.spies.writeOperations).toHaveBeenNthCalledWith(2, Buffer.from('c'));
  expect(writer.spies.writeRegistry).toHaveBeenNthCalledWith(2, Buffer.from('d'));

  await batcher.stop();
});

test('wait for the inFlight promises to finish when stopped', async () => {
  const sent = jest.fn();
  const writer = mockWriter(async () => {
    await waitFor(200);
    sent();
  });

  const batcher = createBatcher({
    logger: mockLogger(),
    intervalInMS: 1000,
    limitInBytes: 1,
    writer,
  });

  batcher.start();

  batcher.add({
    operations: ['a', 'b', 'c'],
    operation_collection: ['d', 'e', 'f'],
  });

  expect(writer.spies.writeOperations).toHaveBeenCalledTimes(1);
  expect(writer.spies.writeRegistry).toHaveBeenCalledTimes(1);
  expect(sent).not.toHaveBeenCalled();
  await batcher.stop();
  expect(sent).toHaveBeenCalledTimes(2); // 2 because we have 2 writers (operations and registry)
});

test('flush remaining chunks when stopped', async () => {
  const writer = mockWriter();

  const batcher = createBatcher({
    logger: mockLogger(),
    intervalInMS: 1000,
    limitInBytes: 1000,
    writer,
  });

  batcher.start();

  batcher.add({
    operations: ['a', 'b', 'c'],
    operation_collection: ['d', 'e', 'f'],
  });

  await batcher.stop();

  expect(writer.spies.writeOperations).toHaveBeenCalledTimes(1);
  expect(writer.spies.writeRegistry).toHaveBeenCalledTimes(1);
});

test('removes the delimiter from the end', async () => {
  const writer = mockWriter();

  const batcher = createBatcher({
    logger: mockLogger(),
    intervalInMS: 1000,
    limitInBytes: 1000,
    writer,
  });

  batcher.start();

  batcher.add({
    operations: ['a', 'b', 'c'],
    operation_collection: ['d', 'e', 'f'],
  });

  await batcher.stop();

  expect(writer.spies.writeOperations).toHaveBeenCalledWith(Buffer.from(['a', 'b', 'c'].join('\n')));
  expect(writer.spies.writeRegistry).toHaveBeenCalledWith(Buffer.from(['d', 'e', 'f'].join('\n')));
});
