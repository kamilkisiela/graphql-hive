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
   * Note that the lock will be extended by the duration all
   * the way until release (unlock).
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
  ): Promise<() => void> {
    return new Promise((acquired, rejected) => {
      this.logger.debug('Acquiring lock (id=%s)', id);

      let unlock!: () => void;
      const l = Promise.race([
        new Promise<void>(resolve => {
          signal.addEventListener(
            'abort',
            () => {
              this.logger.warn('Lock aborted (id=%s)', id);
              rejected(new Error('Locking aborted'));
              resolve();
            },
            { once: true },
          );
        }),
        new Promise<void>(resolve => (unlock = resolve)),
      ]);

      this.redlock
        .using(
          [id],
          duration,
          {
            retryCount: retries,
            retryDelay,
          },
          // TODO: how to handle the extension fail signal? it basically gets
          //       invoked if the lock extension failed for whatever reason
          _extensionFailSignal => {
            this.logger.debug('Lock acquired (id=%s)', id);
            acquired(() => {
              this.logger.debug('Releasing lock (id=%s)', id);
              unlock();
            });
            return l;
          },
        )
        .catch(err => {
          // should never happen because nothing throws, but never assume anything 🤷
          this.logger.error('Lock usage error (id=%s, err=%s)', id, err);
        });
    });
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
      unlock();
    }
  }
}
