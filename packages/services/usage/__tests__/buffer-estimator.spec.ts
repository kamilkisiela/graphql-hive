import { createEstimator } from '../src/buffer';

const eventHubLimitInBytes = 900_000;
const bufferSize = 1200;
const defaultBytesPerUnit = eventHubLimitInBytes / bufferSize;

function waitFor(time: number) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

test('default estimation should be a ratio of max size and the limit in bytes', () => {
  const estimator = createEstimator({
    logger: console as any,
    defaultBytesPerUnit,
    resetAfter: 5000,
    increaseBy() {
      return 0;
    },
  });

  expect(estimator.estimate(bufferSize)).toBeCloseTo(eventHubLimitInBytes);
});

test('teach estimator that 1 op takes 100 bytes', () => {
  const estimator = createEstimator({
    logger: console as any,
    defaultBytesPerUnit,
    resetAfter: 5000,
    increaseBy() {
      return 0;
    },
  });

  estimator.teach({
    bytes: 1000,
    operations: 10,
  });

  expect(estimator.estimate(10)).toBeCloseTo(1000);
});

test('increasing the defaultBytesPerUnit', () => {
  const estimator = createEstimator({
    defaultBytesPerUnit,
    resetAfter: 5000,
    logger: {
      info: jest.fn(),
    } as any,
    increaseBy() {
      return 0.25;
    },
  });

  expect(estimator.estimate(bufferSize)).toBeCloseTo(eventHubLimitInBytes);

  estimator.overflowed('test');

  expect(estimator.estimate(bufferSize)).toBeCloseTo(
    1.25 * eventHubLimitInBytes
  );
});

test('increasing the defaultBytesPerUnit should not go over 50% of original estimation', () => {
  const estimator = createEstimator({
    defaultBytesPerUnit,
    resetAfter: 5000,
    logger: {
      info: jest.fn(),
    } as any,
    increaseBy() {
      return 0.6;
    },
  });

  expect(estimator.estimate(bufferSize)).toBeCloseTo(eventHubLimitInBytes);

  estimator.overflowed('test');

  expect(estimator.estimate(bufferSize)).toBeCloseTo(
    1.5 * eventHubLimitInBytes
  );
});

test('teach estimator multiple times', () => {
  const estimator = createEstimator({
    defaultBytesPerUnit,
    resetAfter: 5000,
    logger: {
      info: jest.fn(),
    } as any,
    increaseBy() {
      return 0;
    },
  });

  estimator.teach({
    bytes: 1_000,
    operations: 10,
  });

  estimator.teach({
    bytes: 500,
    operations: 5,
  });

  estimator.teach({
    bytes: 10_000,
    operations: 100,
  });

  expect(estimator.estimate(10)).toBeCloseTo(1000);
});

test('reset after N milliseconds', async () => {
  const estimator = createEstimator({
    defaultBytesPerUnit,
    resetAfter: 100,
    logger: {
      info: jest.fn(),
    } as any,
    increaseBy() {
      return 0;
    },
  });

  estimator.teach({
    bytes: 1_000,
    operations: 10,
  });

  expect(estimator.estimate(10)).toBeCloseTo(1000);

  await waitFor(100);

  // reached 15 ms, so reset
  estimator.teach({
    bytes: 500,
    operations: 10,
  });

  // teaching from start
  estimator.teach({
    bytes: 500,
    operations: 10,
  });

  expect(estimator.estimate(10)).toBeCloseTo(500);
});
