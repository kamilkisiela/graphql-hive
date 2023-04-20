import Redis from 'ioredis-mock';
import 'reflect-metadata';
import { Logger } from '../providers/logger';
import { Mutex } from '../providers/mutex';

it('should allow only one lock at a time', async () => {
  const mutex = new Mutex(new Tlogger(), new Redis());

  const ctrl = new AbortController();
  const signal = ctrl.signal;

  const unlock1 = await mutex.lock('1', { signal });

  const lock2 = mutex.lock('1', { signal });

  // second lock shouldnt resolve
  await expect(Promise.race([throwAfter(50), lock2])).rejects.toBeTruthy();

  await unlock1();

  // after the first lock releases, second one resolves
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

function throwAfter(ms: number) {
  return new Promise((_, reject) => setTimeout(() => reject(`Throwing after ${ms}ms`), ms));
}
