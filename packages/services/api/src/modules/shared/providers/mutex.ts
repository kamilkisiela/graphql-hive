import { Inject, Injectable } from 'graphql-modules';
import Redlock, { Lock } from 'redlock';
import { Logger } from './logger';
import type { Redis } from './redis';
import { REDIS_INSTANCE } from './redis';

export interface MutexLockOptions {
  signal: AbortSignal;
  /**
   * The lock timeout/duration in milliseconds.
   *
   * Note that the timeout is _between_ retries, not the total timeout.
   *
   * @default 60_000
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

  public lock(id: string, { signal, timeout = 60_000, retries = 10 }: MutexLockOptions) {
    let lock: Lock | null = null;
    return Promise.race([
      new Promise<never>((_, reject) => {
        const listener = () => {
          signal.removeEventListener('abort', listener);
          if (!lock) {
            return reject(new Error('Locking aborted'));
          }
          lock
            .release()
            .catch(err => {
              this.logger.error('Unable to release lock after aborted (id=%s, err=%s)', id, err);
            })
            .finally(() => {
              reject(new Error('Locking aborted'));
            });
        };
        signal.addEventListener('abort', listener);
      }),
      (async () => {
        if (signal.aborted) {
          throw new Error('Locking aborted');
        }
        this.logger.debug('Acquiring lock (id=%s)', id);
        const thisLock = await this.redlock.acquire([id], timeout, { retryCount: retries });
        if (signal.aborted) {
          thisLock.release().catch(err => {
            this.logger.error('Unable to release lock after aborted (id=%s, err=%s)', id, err);
          });
          throw new Error('Locking aborted');
        }
        lock = thisLock;
        this.logger.debug('Lock acquired (id=%s)', id);
        return async () => {
          this.logger.debug('Releasing lock (id=%s)', id);
          lock = null;

          // It is safe to re-attempt a release in case the lock was aborted.
          // See more: https://github.com/mike-marcacci/node-redlock/blob/5dd9e281daae8f086ccb9284a9fc8709faf74a2a/src/index.ts#L343-L364
          await thisLock.release();
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
