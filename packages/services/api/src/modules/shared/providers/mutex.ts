import { Inject, Injectable } from 'graphql-modules';
import Redlock, { ResourceLockedError } from 'redlock';
import { Logger } from './logger';
import type { Redis } from './redis';
import { REDIS_INSTANCE } from './redis';

export interface MutexLockOptions {
  signal: AbortSignal;
  /**
   * The lock duration in milliseconds. Beware that the duration
   * is how long the lock can be held, not the acquire timeout.
   *
   * @default 60_000
   */
  duration?: number;
  /**
   * How many times is the lock acquire retried before failing.
   *
   * @default 60
   */
  retries?: number;
  /**
   * How long to wait between lock acquire retries in milliseconds.
   *
   * The total lock timeout is then retries multiplied by the retryDelay.
   * For example: 60 (retries) * 1000ms (retryDelay) = 1min.
   *
   * @default 1000
   */
  retryDelay?: number;
}

@Injectable()
export class Mutex {
  private logger: Logger;
  private redlock: Redlock;

  constructor(logger: Logger, @Inject(REDIS_INSTANCE) redis: Redis) {
    this.logger = logger.child({ service: 'Mutex' });
    this.redlock = new Redlock([redis]);
    this.redlock.on('error', err => {
      // these errors will be reported directly by the locking mechanism
      if (err instanceof ResourceLockedError) {
        return;
      }
      this.logger.error(err);
    });
  }

  public lock(
    id: string,
    { signal, duration = 60_000, retries = 60, retryDelay = 1000 }: MutexLockOptions,
  ) {
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
        const lock = await this.redlock.acquire([id], duration, {
          retryCount: retries,
          retryDelay,
        });
        if (signal.aborted) {
          lock.release().catch(err => {
            // it is safe to not throw the error, as the lock will
            // automatically expire after its duration is exceeded
            // TODO: should this be logged as an error? a release may fail if there
            //       is no lock to release, like when the duration gets exceeded
            this.logger.warn('Lock release problem after aborted (id=%s, err=%s)', id, err);
          });
          throw new Error('Locking aborted');
        }
        this.logger.debug('Lock acquired (id=%s)', id);
        const listener = () => {
          this.logger.debug('Releasing lock after aborted (id=%s)', id);
          signal.removeEventListener('abort', listener);
          lock.release().catch(err => {
            // it is safe to not throw the error, as the lock will
            // automatically expire after its duration is exceeded
            // TODO: should this be logged as an error? a release may fail if there
            //       is no lock to release, like when the duration gets exceeded
            this.logger.warn('Lock release problem after aborted (id=%s, err=%s)', id, err);
          });
        };
        signal.addEventListener('abort', listener);
        return async () => {
          if (signal.aborted) {
            this.logger.debug('Lock already released because aborted (id=%s)', id);
            return;
          }
          this.logger.debug('Releasing lock (id=%s)', id);
          await lock.release().catch(err => {
            // it is safe to not throw the error, as the lock will
            // automatically expire after its duration is exceeded
            // TODO: should this be logged as an error? a release may fail if there
            //       is no lock to release, like when the duration gets exceeded
            this.logger.warn('Lock release problem (id=%s, err=%s)', id, err);
          });
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
