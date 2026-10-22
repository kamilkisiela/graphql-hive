import { bench, describe } from 'vitest';
import { createKVBuffer } from '../src/buffer';

const noop = () => {};
const logger = { info: noop, error: noop } as any;
const report = {
  size: 28,
  map: Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`key-${i}`, i])),
};

function fillCurrent(count: number) {
  const buffer = createKVBuffer({
    logger,
    size: count + 1,
    interval: 60_000,
    limitInBytes: 500_000,
    useEstimator: true,
    calculateReportSize: value => Object.keys(value.map).length,
    isSplittable: value => Object.keys(value.map).length > 1,
    split: value => [value],
    onRetry: noop,
    onDrop: noop,
    isTooLargePayloadError: () => false,
    sender: async () => {},
  });

  for (let i = 0; i < count; i++) {
    buffer.add(report);
  }
}

for (const count of [100, 500, 1_000, 2_000]) {
  // | Reports | Before     | After     | Speedup |
  // | 100     | 0.0165 ms  | 0.0079 ms | 2.1x    |
  // | 500     | 0.1897 ms  | 0.0190 ms | 10.0x   |
  // | 1000    | 0.6847 ms  | 0.0331 ms | 20.7x   |
  // | 2000    | 2.6089 ms  | 0.0616 ms | 42.4x   |
  describe(`fill ${count} reports`, () => {
    bench('buffer.add', () => fillCurrent(count), {
      time: 1_000,
      warmupTime: 100,
    });
  });
}
