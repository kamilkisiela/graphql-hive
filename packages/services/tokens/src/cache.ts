import type { FastifyLoggerInstance } from 'fastify';
import type { Redis } from 'ioredis';
import ms from 'ms';
import LRU from 'tiny-lru';
import { atomic, until, useActionTracker } from './helpers';
import { cacheHits, cacheInvalidations, cacheMisses } from './metrics';
import type { Storage, StorageItem } from './storage';

function generateKey(token: string) {
  return `tokens:cache:${token}`;
}

interface CacheStorage extends Omit<Storage, 'touchTokens'> {
  invalidateTokens(tokens: string[]): Promise<void>;
}

const TTLSeconds = {
  /**
   * TTL for tokens that don't exist in the DB.
   */
  notFound: 60, // seconds
  /**
   * TTL for tokens that exist in the DB.
   */
  found: 60 * 5, // 5 minutes
  /**
   * TTL for tokens in the in-memory cache.
   * Helps to reduce the traffic that goes to Redis (as we read the token from in-memory cache first) and in case Redis is down.
   */
  inMemory: 60, // seconds
};

function useSafeRedis(redis: Redis, logger: FastifyLoggerInstance) {
  const cache = LRU<string>(1000, TTLSeconds.inMemory * 1000 /* s -> ms */);

  // Purge the cache when redis is ready (when it reconnects or when it starts)
  redis.on('ready', () => {
    logger.info('Redis is ready, purging the in-memory cache');
    cache.clear();
  });

  return {
    async get(key: string) {
      const cached = cache.get(key);

      if (cached) {
        return cached;
      }

      if (redis.status === 'ready') {
        return redis.get(key);
      }

      logger.warn('Redis is not ready, skipping GET');
      return cache.get(key);
    },
    async del(keys: string[]) {
      for (const key of keys) {
        cache.delete(key);
      }

      if (redis.status === 'ready') {
        await redis.del(...keys);
      } else {
        logger.warn('Redis is not ready, skipping DEL');
      }
    },
    async setex(key: string, ttl: number, value: string) {
      cache.set(key, value);

      if (redis.status === 'ready') {
        await redis.setex(key, ttl, value);
      } else {
        logger.warn('Redis is not ready, skipping SETEX');
      }
    },
  };
}

// Cache is a wrapper around the storage that adds a cache layer.
// It also handles invalidation of the cache.
// It also handles the "touch" logic to mark tokens as used and update the "lastUsedAt" column in PG.
// Without the cache we would hit the DB for every request, with the cache we hit it only once (until a token is invalidated).
export function useCache(
  storagePromise: Promise<Storage>,
  redisInstance: Redis,
  logger: FastifyLoggerInstance,
): {
  start(): Promise<void>;
  stop(): Promise<void>;
  readiness(): boolean;
  getStorage(): Promise<CacheStorage>;
} {
  let started = false;
  let cachedStoragePromise: Promise<CacheStorage> | null = null;

  function getStorage() {
    if (!cachedStoragePromise) {
      cachedStoragePromise = create();
    }

    return cachedStoragePromise;
  }

  const tracker = useActionTracker();
  const redis = useSafeRedis(redisInstance, logger);

  async function create() {
    const storage = await storagePromise;
    const touch = useTokenTouchScheduler(storage, logger);

    // When there's a new token or a token was removed we need to invalidate the cache
    async function invalidateTokens(tokens: string[]) {
      cacheInvalidations.inc(1);

      await redis.del(tokens.map(generateKey));
    }

    // Thanks to the `atomic` function, every call to this function will only be executed once and Promise will be shared.
    // This is important because we don't want to make multiple requests to the DB for the same token, at the same time.
    const readTokenFromStorage = atomic(async function _readToken(token: string) {
      const item = await storage.readToken(token);

      if (!item) {
        // If the token doesn't exist in the DB we still want to cache it for a short period of time to avoid hitting the DB again and again.
        await redis.setex(generateKey(token), TTLSeconds.notFound, JSON.stringify(null));
      } else {
        await redis.setex(generateKey(token), TTLSeconds.found, JSON.stringify(item));
      }

      return item;
    });

    // Thanks to the `atomic` function, every call to this function will only be executed once and Promise will be shared.
    // This is important because we don't want to make multiple requests to Redis for the same token, at the same time.
    const readTokenFromRedis = atomic(async function _readToken(
      hashed_token: string,
    ): Promise<StorageItem | null | undefined> {
      const item = await redis.get(generateKey(hashed_token));

      if (typeof item === 'string') {
        return JSON.parse(item);
      }

      return;
    });

    const cachedStorage: CacheStorage = {
      destroy() {
        return storage.destroy();
      },
      invalidateTokens(tokens) {
        return invalidateTokens(tokens);
      },
      readTarget(target) {
        return storage.readTarget(target);
      },
      async readToken(hashed_token) {
        const cached = await readTokenFromRedis(hashed_token);

        if (typeof cached !== 'undefined') {
          cacheHits.inc(1);
          // mark as used
          touch.schedule(hashed_token);
          return cached;
        }

        cacheMisses.inc(1);

        const item = await readTokenFromStorage(hashed_token);

        if (!item) {
          return null;
        }

        touch.schedule(hashed_token); // mark as used

        return item;
      },
      writeToken: tracker.wrap(async item => {
        logger.debug('Writing token (target=%s)', item.target);
        const result = await storage.writeToken(item);

        return result;
      }),
      deleteToken: tracker.wrap(async hashed_token => {
        await redis.del([generateKey(hashed_token)]);

        return storage.deleteToken(hashed_token);
      }),
    };

    started = true;

    return cachedStorage;
  }

  async function start() {
    await getStorage();
  }

  async function stop() {
    logger.info('Started Tokens shutdown...');
    started = false;

    // Wait for all the pending operations to finish
    await until(tracker.idle, 10_000).catch(error => {
      logger.error('Failed to wait for tokens being idle', error);
    });

    if (cachedStoragePromise) {
      await (await cachedStoragePromise).destroy();
    }

    // Wait for Redis to finish all the pending operations
    await redisInstance.quit();

    process.exit(0);
  }

  function readiness() {
    return started && (redisInstance.status === 'ready' || redisInstance.status === 'reconnecting');
  }

  return {
    start,
    stop,
    readiness,
    getStorage,
  };
}

function useTokenTouchScheduler(storage: Storage, logger: FastifyLoggerInstance) {
  const scheduledTokens = new Map<string, Date>();

  /**
   * Mark token as used
   */
  function schedule(hashed_token: string): void {
    const now = new Date();
    scheduledTokens.set(hashed_token, now);
  }

  // updated every 10m
  const interval = setInterval(() => {
    if (!scheduledTokens.size) {
      return;
    }

    const tokens = Array.from(scheduledTokens.entries()).map(([token, date]) => ({
      token,
      date,
    }));
    scheduledTokens.clear();

    logger.debug(`Touch ${tokens.length} tokens`);
    storage.touchTokens(tokens).catch(error => {
      logger.error(error);
    });
  }, ms('60s'));

  function dispose() {
    clearInterval(interval);
  }

  return {
    schedule,
    dispose,
  };
}
