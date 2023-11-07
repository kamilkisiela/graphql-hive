import { Inject, Injectable, Scope } from 'graphql-modules';
import * as Sentry from '@sentry/node';
import { Logger } from '../../shared/providers/logger';
import type { Redis } from '../../shared/providers/redis';
import { REDIS_INSTANCE } from '../../shared/providers/redis';

@Injectable({
  scope: Scope.Operation,
})
export class DistributedCache {
  private logger: Logger;
  constructor(
    logger: Logger,
    @Inject(REDIS_INSTANCE) private redis: Redis,
  ) {
    this.logger = logger.child({ service: 'DistributedCache' });
  }

  async wrap<T>({
    key,
    executor,
    ttlSeconds,
  }: {
    key: string;
    executor: () => Promise<T>;
    /**
     * How long the result should be cached in seconds.
     */
    ttlSeconds: number;
  }): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached) {
      return cached;
    }

    const result = await executor();

    await this.set<T>({ key, data: result, ttlSeconds });

    return result;
  }

  private async set<T>({ key, data, ttlSeconds }: { key: string; data: T; ttlSeconds: number }) {
    let str;
    try {
      str = JSON.stringify(data);
    } catch (error) {
      // In case we fail to stringify the result, we skip caching.
      // This way we do not block user and just put a bit more load on the backend.
      // We also log the error to Sentry so we can investigate the issue.
      this.logger.error('Failed to stringify data');
      Sentry.captureException(error, {
        extra: {
          distributedCacheKey: key,
        },
      });
    }

    if (typeof str === 'string') {
      try {
        await this.redis.setex(key, ttlSeconds, str);
      } catch (error) {
        // In case we fail to persist the result, we skip caching.
        // This way we do not block user and just put a bit more load on the backend.
        // We also log the error to Sentry so we can investigate the issue.
        this.logger.error('Failed to write data to Redis');
        Sentry.captureException(error, {
          extra: {
            distributedCacheKey: key,
          },
        });
      }
    }
  }

  /**
   * Reads the cache data from Redis.
   * `null` means cache miss.
   */
  private async get<T>(key: string): Promise<T | null> {
    const data = await this.redis.get(key);
    if (typeof data === 'string') {
      try {
        return JSON.parse(data);
      } catch (error) {
        // Gracefully handle the case when the cache data is corrupted.
        // In case we fail to read and parse the cache result, we treat it as cache miss.
        // This way we do not block user and just put a bit more load on the backend.
        // We also log the error to Sentry so we can investigate the issue.
        this.logger.error('Failed to parse data');
        Sentry.captureException(error, {
          tags: {
            distributedCacheKey: key,
          },
        });
      }
    }
    return null;
  }
}
