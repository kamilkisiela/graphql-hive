import Redis from 'ioredis-mock';
import 'reflect-metadata';
import { Logger } from '../providers/logger';
import { Mutex } from '../providers/mutex';

describe('Single process', () => {
  it('should allow only one lock at a time', async () => {
    const mutex = new Mutex(new Tlogger(), new Redis(randomPort()));

    const [signal] = createSignal();

    const unlock1 = await mutex.lock('1', { signal });

    const lock2 = mutex.lock('1', { signal });

    // second lock shouldnt resolve
    await expect(Promise.race([throwAfter(50), lock2])).rejects.toBeTruthy();

    await unlock1();

    // after the first lock releases, second one resolves
    await expect(lock2).resolves.toBeTruthy();
  });

  it('should time out after the specified duration', async () => {
    const mutex = new Mutex(new Tlogger(), new Redis(randomPort()));

    const [signal] = createSignal();

    await mutex.lock('1', { signal });

    const lock2 = mutex.lock('1', { signal, timeout: 50, retries: 0 });

    await expect(lock2).rejects.toMatchInlineSnapshot(
      '[ExecutionError: The operation was unable to achieve a quorum during its retry window.]',
    );
  });

  it('should cancel locking on abort signal', async () => {
    const mutex = new Mutex(new Tlogger(), new Redis(randomPort()));

    const [signal, abort] = createSignal();

    const unlock1 = await mutex.lock('1', { signal });

    const lock2 = mutex.lock('1', { signal });

    abort();

    await expect(lock2).rejects.toMatchInlineSnapshot('[Error: Locking aborted]');

    await unlock1();

    // make sure that the aborted lock does not lock
    await expect(mutex.lock('1', { signal: createSignal()[0] })).resolves.toBeTruthy();
  });
});

describe.todo('Multiple processes');

class Tlogger implements Logger {
  public info = vi.fn();
  public warn = vi.fn();
  public error = vi.fn();
  public fatal = vi.fn();
  public trace = vi.fn();
  public debug = vi.fn();
  public child = () => this;
}

function throwAfter(ms: number) {
  return new Promise((_, reject) => setTimeout(() => reject(`Throwing after ${ms}ms`), ms));
}

function randomPort() {
  return Math.floor(Math.random() * 100);
}

function createSignal(): [signal: AbortSignal, abort: () => void] {
  const ctrl = new AbortController();
  return [ctrl.signal, () => ctrl.abort()];
}
