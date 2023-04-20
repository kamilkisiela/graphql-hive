import { Inject, Injectable } from 'graphql-modules';
import Redlock from 'redlock';
import { Logger } from './logger';
import type { Redis } from './redis';
import { REDIS_INSTANCE } from './redis';

export interface MutexLockOptions {
  signal: AbortSignal;
  /**
   * The lock timeout/duration in milliseconds.
   *
   * Note that the timeout is _between_ retries, not the total
   * timeout. For example, if you retry 10 times with a 6 second
   * duration - the lock will time out after 1 minute (60 seconds).
   *
   * @default 6_000
   */
  timeout?: number;
  /**
   * How many times is the lock retried before failing.
   *
   * @default 10
   */
  retries?: number;
}

@Injectable()
export class Mutex {
  private logger: Logger;
  private redlock: Redlock;

  constructor(logger: Logger, @Inject(REDIS_INSTANCE) redis: Redis) {
    this.logger = logger.child({ service: 'Mutex' });
    this.redlock = new Redlock([redis]);
    this.redlock.on('error', err => {
      logger.error(err);
    });
  }

  public lock(id: string, { signal, timeout = 6_000, retries = 10 }: MutexLockOptions) {
    return Promise.race([
      new Promise<never>((_, reject) => {
        const listener = () => {
          signal.removeEventListener('abort', listener);
          reject(new Error('Locking aborted'));
        };
        signal.addEventListener('abort', listener);
      }),
      (async () => {
        if (signal.aborted) {
          throw new Error('Locking aborted');
        }
        this.logger.debug('Acquiring lock (id=%s)', id);
        const lock = await this.redlock.acquire([id], timeout, { retryCount: retries });
        if (signal.aborted) {
          lock.release().catch(err => {
            this.logger.error('Unable to release lock after aborted (id=%s, err=%s)', id, err);
          });
          throw new Error('Locking aborted');
        }
        this.logger.debug('Lock acquired (id=%s)', id);
        return async () => {
          this.logger.debug('Releasing lock (id=%s)', id);
          await lock.release();
        };
      })(),
    ]);
  }

  public async perform<T>(
    id: string,
    opts: MutexLockOptions,
    action: () => T | Promise<T>,
  ): Promise<T> {
    const unlock = await this.lock(id, opts);
    try {
      return await action();
    } finally {
      await unlock();
    }
  }
}
