import Redis from 'ioredis-mock';
import 'reflect-metadata';
import { Logger } from '../providers/logger';
import { Mutex } from '../providers/mutex';

it('should allow only one lock at a time', async ({ expect }) => {
  const mutex = new Mutex(new Tlogger(), new Redis(differentPort()));

  const [signal] = createSignal();

  const unlock1 = await mutex.lock('1', { signal });

  const lock2 = mutex.lock('1', { signal });

  // second lock shouldnt resolve
  await expect(Promise.race([throwAfter(50), lock2])).rejects.toBeTruthy();

  await unlock1();

  // after the first lock releases, second one resolves
  await expect(lock2).resolves.toBeTruthy();
});

it('should allow different locks at any time', async ({ expect }) => {
  const mutex = new Mutex(new Tlogger(), new Redis(differentPort()));

  const [signal] = createSignal();

  await expect(mutex.lock('1', { signal })).resolves.toBeTruthy();
  await expect(mutex.lock('2', { signal })).resolves.toBeTruthy();
  await expect(mutex.lock('3', { signal })).resolves.toBeTruthy();
});

it('should release lock in perform after return', async ({ expect }) => {
  const mutex = new Mutex(new Tlogger(), new Redis(differentPort()));

  const [signal] = createSignal();

  const result = {};
  await expect(
    mutex.perform('1', { signal }, () => {
      return result;
    }),
  ).resolves.toBe(result);

  await expect(mutex.lock('1', { signal })).resolves.toBeTruthy();
});

it('should release lock in perform on throw', async ({ expect }) => {
  const mutex = new Mutex(new Tlogger(), new Redis(differentPort()));

  const [signal] = createSignal();

  const whoops = new Error('Whoops!');
  await expect(
    mutex.perform('1', { signal }, async () => {
      throw whoops;
    }),
  ).rejects.toBe(whoops);

  await expect(mutex.lock('1', { signal })).resolves.toBeTruthy();
});

// since vitest uses workers (which run in separate threads), this can be tested
describe.concurrent('should serialise concurrent threads', () => {
  const mutex = new Mutex(new Tlogger(), new Redis(differentPort()));
  const [signal] = createSignal();

  let running = false;
  for (let i = 1; i <= 20; i++) {
    it(`#${i}`, async ({ expect }) => {
      await mutex.perform('1', { signal, retryDelay: 50 }, async () => {
        expect(running).toBeFalsy();
        running = true;
        await sleep();
        running = false;
      });
    });
  }
});

it('should keep auto-extending lock until unlock', async ({ expect }) => {
  const mutex = new Mutex(new Tlogger(), new Redis(differentPort()));
  const [signal] = createSignal();

  const unlock = await mutex.lock('1', {
    signal,
    autoExtendThreshold: 100,
    // duration needs to be 100ms more than the autoExtendThreshold
    duration: 200,
  });

  await sleep(600); // extended at least 2 times

  const lock2 = mutex.lock('1', { signal: createSignal()[0] });

  // second lock still cannot be acquired resolve
  await expect(Promise.race([throwAfter(50), lock2])).rejects.toBeTruthy();

  await unlock();

  // only after unlock can the second lock be acquired
  await expect(lock2).resolves.toBeTruthy();
});

class Tlogger implements Logger {
  public info = vi.fn();
  public warn = vi.fn();
  public error = vi.fn();
  public fatal = vi.fn();
  public trace = vi.fn();
  public debug = vi.fn();
  public child = () => this;
}

function sleep(ms = 50) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function throwAfter(ms: number) {
  await sleep(ms);
  throw `Throwing after ${ms}ms`;
}

// make sure the ports are really different
const usedPorts: number[] = [];
function differentPort(): number {
  const port = Math.floor(Math.random() * 100);
  if (!usedPorts.includes(port)) {
    usedPorts.push(port);
    return port;
  }
  return differentPort();
}

function createSignal(): [signal: AbortSignal, abort: () => void] {
  const ctrl = new AbortController();
  return [ctrl.signal, () => ctrl.abort()];
}
