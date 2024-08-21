import { Inject, Injectable } from 'graphql-modules';
import Redlock, { ExecutionError, ResourceLockedError } from 'redlock';
import { traceFn } from '@hive/service-common';
import { Logger } from './logger';
import type { Redis } from './redis';
import { REDIS_INSTANCE } from './redis';

export interface MutexLockOptions {
  signal: AbortSignal;
  /**
   * The lock duration in milliseconds. Beware that the duration
   * is how long is the lock held, not the acquire timeout.
   *
   * Note that the lock will be auto-extended by the duration all
   * the way until released (unlocked).
   *
   * @default 10_000
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
  /**
   * The minimum remaining time in milliseconds on the lock before auto-extension.
   *
   * @default 500
   */
  autoExtendThreshold?: number;
}

/** Error indicating that a resource is locked and the lock can not be acquired within the provided time frame. */
export class MutexResourceLockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MutexError';
  }
}
/**
 * Perform an action under a mutex lock,ensuring that only one action is performed at a time for a given resource for
 * preventing race conditions and ensures data integrity by managing concurrent access to the locked resources.
 */
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

  @traceFn('Mutex.lock', {
    initAttributes: (id, options) => ({
      'lock.id': id,
      'lock.duration': options.duration,
      'lock.retries': options.retries,
      'lock.retryDelay': options.retryDelay,
      'lock.autoExtendThreshold': options.autoExtendThreshold,
    }),
    errorAttributes: error => ({
      'error.message': error.message,
    }),
  })
  async lock(
    id: string,
    {
      signal,
      duration = 10_000,
      retries = 30,
      retryDelay = 1_000,
      autoExtendThreshold = 1_000,
    }: MutexLockOptions,
  ) {
    const { logger } = this;
    logger.debug('Acquiring lock (id=%s)', id);

    // we try to acquire the lock
    let lock = await this.redlock
      .acquire([id], duration, {
        retryCount: retries,
        retryDelay,
      })
      .catch(err => {
        logger.debug('Acquiring lock failed (id=%s)', id);
        if (signal.aborted) {
          throw new Error('Request has been aborted.');
        }

        // Note: This is kind of a workaround.
        // The redlock library should not throw `ExecutionError`, but `ResourceLockedError`.
        // We have our own error here for the Mutex.
        // See https://github.com/mike-marcacci/node-redlock/issues/168
        if (
          err instanceof ExecutionError &&
          err.message === 'The operation was unable to achieve a quorum during its retry window.'
        ) {
          throw new MutexResourceLockedError(`Resource "${id}" is locked.`);
        }

        throw err;
      });

    // If we acquired the lock but the request got canceled, we want to immediately release it,
    // so other pending requests can take over.
    if (signal.aborted) {
      logger.debug('Request has been aborted, release lock. (id=%s)', id);
      await lock.release();
      throw new Error('Request has been aborted.');
    }

    let extendTimeout: NodeJS.Timeout | undefined;
    // we have a global timeout of 90 seconds to avoid dead-licks
    const globalTimeout = setTimeout(() => {
      logger.error('Global lock timeout exceeded (id=%s)', id);
      void cleanup();
    }, 90_000);

    /** cleanup timers and release the lock. */
    function cleanup() {
      if (extendTimeout === undefined) {
        return;
      }

      logger.debug('Releasing lock (id=%s)', id);
      clearTimeout(extendTimeout);
      clearTimeout(globalTimeout);

      extendTimeout = undefined;
      if (lock.expiration > new Date().getTime()) {
        void lock.release().catch(err => {
          logger.error('Failed to release lock (id=%s)', id);
          console.error(err);
        });
      }
    }

    async function extendLock(isInitial = false) {
      if (isInitial === false) {
        logger.debug('Attempt extended lock (id=%s)', id);
        try {
          // NOTE: extending a lock creates a new lock instance, so we need to replace it here.
          lock = await lock.extend(duration);
          logger.debug('Lock extend succeeded (id=%s)', id);
        } catch (err) {
          logger.error('Failed to extend lock (id=%s)', id);
          console.error(err);
          return;
        }
      }

      extendTimeout = setTimeout(extendLock, lock.expiration - Date.now() - autoExtendThreshold);
    }

    logger.debug('Lock acquired (id=%s)', id);

    await extendLock(true);

    return cleanup;
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
