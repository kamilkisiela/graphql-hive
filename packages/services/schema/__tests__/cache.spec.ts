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
      warn: vi.fn() as any,
    },
    prefix: randomString(),
    pollIntervalMs: 30,
    timeoutMs: 100,
    ttlMs: {
      success: 100,
      failure: 100,
    },
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
      warn: vi.fn() as any,
    },
    prefix: randomString(),
    pollIntervalMs: 30,
    timeoutMs: 100,
    ttlMs: {
      success: 100,
      failure: 100,
    },
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
      warn: vi.fn() as any,
    },
    prefix: randomString(),
    pollIntervalMs: 30,
    timeoutMs: 100,
    ttlMs: {
      success: 100,
      failure: 100,
    },
  });

  const spy = vi.fn();

  const run = cache.reuse(randomString(), async () => {
    spy();
    await waitFor(50);
    return 'foo';
  });

  const run1 = run({});
  const run2 = run({});

  await expect(run1).resolves.toBe('foo');
  await expect(run2).resolves.toBe('foo');
  expect(spy).toHaveBeenCalledTimes(1);
});

test('cache the result of an action', async ({ expect }) => {
  const ttlMs = {
    success: 200,
    failure: 100,
  };
  const cache = createCache({
    redis: new Redis(),
    logger: {
      debug: vi.fn() as any,
      warn: vi.fn() as any,
    },
    prefix: randomString(),
    pollIntervalMs: 10,
    timeoutMs: 50,
    ttlMs,
  });

  const spy = vi.fn();

  const run = cache.reuse(randomString(), async () => {
    spy();
    return 'foo';
  });

  await expect(run({})).resolves.toBe('foo');
  await expect(run({})).resolves.toBe('foo');
  expect(spy).toHaveBeenCalledTimes(1);

  await waitFor(ttlMs.success / 2);

  await expect(run({})).resolves.toBe('foo');
  expect(spy).toHaveBeenCalledTimes(1);

  await waitFor(ttlMs.success);
  await expect(run({})).resolves.toBe('foo');
  expect(spy).toHaveBeenCalledTimes(2);
});

test('do not purge the cache when an action fails, persist the failure for some time', async ({
  expect,
}) => {
  const ttlMs = {
    success: 200,
    failure: 50,
  };
  const cache = createCache({
    redis: new Redis(),
    logger: {
      debug: vi.fn() as any,
      warn: vi.fn() as any,
    },
    prefix: randomString(),
    pollIntervalMs: 10,
    timeoutMs: 50,
    ttlMs,
  });

  const spy = vi.fn();
  let calls = 0;

  const run = cache.reuse(randomString(), async () => {
    spy();
    calls++;
    await waitFor(ttlMs.failure / 2);

    if (calls >= 2) {
      // Fail the second time and after
      throw new Error('test');
    }

    return 'foo';
  });

  const run1 = run({});
  const run2 = run({});
  await expect(run1).resolves.toBe('foo');
  await expect(run2).resolves.toBe('foo');
  expect(spy).toHaveBeenCalledTimes(1);

  // Wait for the cache to expire
  await waitFor(ttlMs.success + 10);

  // Run it again
  await expect(run({})).rejects.toThrow('test');
  expect(spy).toHaveBeenCalledTimes(2);
  // Run it again, but this time it hits the cache (persisted failure)
  await expect(run({})).rejects.toThrow('test');
  expect(spy).toHaveBeenCalledTimes(2);

  // Wait for the cache to expire
  await waitFor(ttlMs.failure + 10);
  // Run it again, but this time it calls the factory function
  await expect(run({})).rejects.toThrow('test');
  expect(spy).toHaveBeenCalledTimes(3);
});

test('timeout', async ({ expect }) => {
  const timeoutMs = 50;
  const ttlMs = 100;
  const cache = createCache({
    redis: new Redis(),
    logger: {
      debug: vi.fn() as any,
      warn: vi.fn() as any,
    },
    prefix: randomString(),
    pollIntervalMs: 10,
    timeoutMs,
    ttlMs: {
      success: ttlMs,
      failure: ttlMs,
    },
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

  // Wait for the cache to expire
  await waitFor(ttlMs + 10);
  await expect(run({})).rejects.toThrowError(/timeout/i);
  expect(spy).toHaveBeenCalledTimes(2);
});

test('run action again when the action expires', async ({ expect }) => {
  const ttlMs = 10;
  const redis = new Redis();
  const prefix = randomString();
  const pollIntervalMs = 5;
  const timeoutMs = 50;
  const cacheForRequest1 = createCache({
    redis,
    logger: {
      debug: vi.fn() as any,
      warn: vi.fn() as any,
    },
    prefix,
    pollIntervalMs,
    timeoutMs,
    ttlMs: {
      success: ttlMs,
      failure: ttlMs,
    },
  });

  const cacheForRequest2 = createCache({
    redis,
    logger: {
      debug: vi.fn() as any,
      warn: vi.fn() as any,
    },
    prefix,
    pollIntervalMs,
    timeoutMs,
    ttlMs: {
      success: ttlMs,
      failure: ttlMs,
    },
  });

  const actionId = randomString();
  async function actionFn() {
    await waitFor(timeoutMs);
    return 'foo';
  }

  const exec1 = cacheForRequest1.reuse(actionId, actionFn);
  const exec2 = cacheForRequest2.reuse(actionId, actionFn);

  const run1 = exec1({});
  const run2 = exec2({});
  // force the cache to expire
  await waitFor(ttlMs + 10);
  await redis.flushall();

  await expect(run1).resolves.toBe('foo');
  await expect(run2).resolves.toBe('foo');
});

test('decide on cache duration', async ({ expect }) => {
  const ttlMs = {
    success: 200,
    failure: 50,
  };
  const cache = createCache({
    redis: new Redis(),
    logger: {
      debug: vi.fn() as any,
      warn: vi.fn() as any,
    },
    prefix: randomString(),
    pollIntervalMs: 10,
    timeoutMs: 50,
    ttlMs,
  });

  const spy = vi.fn();
  let calls = 0;

  const run = cache.reuse(
    randomString(),
    async () => {
      spy();
      calls++;
      await waitFor(ttlMs.failure / 2);

      if (calls >= 2) {
        // second time and after
        return 'bar';
      }

      return 'foo';
    },
    result => (result === 'foo' ? 'long' : 'short'),
  );

  const run1 = run({});
  const run2 = run({});
  await expect(run1).resolves.toBe('foo');
  await expect(run2).resolves.toBe('foo');
  expect(spy).toHaveBeenCalledTimes(1);

  // Wait for the cache to expire
  await waitFor(ttlMs.success + 10);

  // Run it again
  await expect(run({})).resolves.toBe('bar');
  expect(spy).toHaveBeenCalledTimes(2);
  // Run it again, but this time it hits the cache (persisted success with short ttl)
  await expect(run({})).resolves.toBe('bar');
  expect(spy).toHaveBeenCalledTimes(2);

  // Wait for the cache to expire
  await waitFor(ttlMs.failure + 10);
  // Run it again, but this time it calls the factory function
  await expect(run({})).resolves.toBe('bar');
  expect(spy).toHaveBeenCalledTimes(3);
});
