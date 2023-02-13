import Redis from 'ioredis-mock';
import { createCache } from '../src/cache';

function randomString() {
  return Math.random().toString(36).substring(2);
}

function waitFor(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

test('catch sync exception', async ({ expect }) => {
  const cache = createCache({
    redis: new Redis(),
    logger: {
      debug: vi.fn() as any,
    },
    prefix: randomString(),
    pollIntervalMs: 30,
    timeoutMs: 2000,
  });

  const run = cache.reuse(randomString(), () => {
    throw new Error('test');
  });

  await expect(run({})).rejects.toThrow('test');
});

test('catch async exception', async ({ expect }) => {
  const cache = createCache({
    redis: new Redis(),
    logger: {
      debug: vi.fn() as any,
    },
    prefix: randomString(),
    pollIntervalMs: 30,
    timeoutMs: 2000,
  });

  const run = cache.reuse(randomString(), async () => {
    throw new Error('test');
  });

  await expect(run({})).rejects.toThrow('test');
});

test('share execution', async ({ expect }) => {
  const cache = createCache({
    redis: new Redis(),
    logger: {
      debug: vi.fn() as any,
    },
    prefix: randomString(),
    pollIntervalMs: 30,
    timeoutMs: 2000,
  });

  const spy = vi.fn();

  const run = cache.reuse(randomString(), async () => {
    spy();
    await waitFor(150);
    return 'foo';
  });

  const run1 = run({});
  const run2 = run({});

  await expect(run1).resolves.toBe('foo');
  await expect(run2).resolves.toBe('foo');
  expect(spy).toHaveBeenCalledTimes(1);
});

test('cache the result of an action for no longer than the timeout', async ({ expect }) => {
  const timeoutMs = 1000;
  const cache = createCache({
    redis: new Redis(),
    logger: {
      debug: vi.fn() as any,
    },
    prefix: randomString(),
    pollIntervalMs: 30,
    timeoutMs,
  });

  const spy = vi.fn();

  const run = cache.reuse(randomString(), async () => {
    spy();
    await waitFor(100);
    return 'foo';
  });

  await expect(run({})).resolves.toBe('foo');
  await expect(run({})).resolves.toBe('foo');
  expect(spy).toHaveBeenCalledTimes(1);

  await waitFor(100);

  await expect(run({})).resolves.toBe('foo');
  expect(spy).toHaveBeenCalledTimes(1);

  await waitFor(timeoutMs);
  await expect(run({})).resolves.toBe('foo');
  expect(spy).toHaveBeenCalledTimes(2);
});

test('purge the cache when an action fails', async ({ expect }) => {
  const timeoutMs = 1000;
  const cache = createCache({
    redis: new Redis(),
    logger: {
      debug: vi.fn() as any,
    },
    prefix: randomString(),
    pollIntervalMs: 30,
    timeoutMs,
  });

  const spy = vi.fn();
  let calls = 0;

  const run = cache.reuse(randomString(), async () => {
    spy();
    calls++;
    await waitFor(100);

    if (calls >= 2) {
      // Fail the second time and after
      throw new Error('test');
    }

    return 'foo';
  });

  await expect(run({})).resolves.toBe('foo');
  await expect(run({})).resolves.toBe('foo');
  expect(spy).toHaveBeenCalledTimes(1);

  // Wait for the cache to expire
  await waitFor(timeoutMs + 100);
  await expect(run({})).rejects.toThrow('test');
  expect(spy).toHaveBeenCalledTimes(2);

  await expect(run({})).rejects.toThrow('test');
  expect(spy).toHaveBeenCalledTimes(3);
});

test('timeout', async ({ expect }) => {
  const timeoutMs = 500;
  const cache = createCache({
    redis: new Redis(),
    logger: {
      debug: vi.fn() as any,
    },
    prefix: randomString(),
    pollIntervalMs: 30,
    timeoutMs,
  });

  const spy = vi.fn();
  const run = cache.reuse(randomString(), async () => {
    spy();
    await waitFor(timeoutMs * 2);
    return 'foo';
  });

  const run1 = run({});
  const run2 = run({});
  await expect(run1).rejects.toThrowError(/timeout/i);
  await expect(run2).rejects.toThrowError(/timeout/i);
  expect(spy).toHaveBeenCalledTimes(1);
});
