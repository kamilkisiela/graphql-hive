import type { FastifyLoggerInstance } from 'fastify';
import Redis, { Redis as RedisInstance } from 'ioredis';
import ms from 'ms';
import { metrics } from '@hive/service-common';
import { atomic, until, useActionTracker } from './helpers';
import type { Storage, StorageItem } from './storage';

function generateKey(token: string) {
  return `tokens:cache:${token}`;
}

const cacheHits = new metrics.Counter({
  name: 'tokens_cache_hits',
  help: 'Number of cache hits',
});

const cacheMisses = new metrics.Counter({
  name: 'tokens_cache_misses',
  help: 'Number of cache misses',
});

const cacheInvalidations = new metrics.Counter({
  name: 'tokens_cache_invalidations',
  help: 'Number of cache invalidations',
});

interface CacheStorage extends Omit<Storage, 'touchTokens'> {
  invalidateTokens(tokens: string[]): Promise<void>;
}

// Cache is a wrapper around the storage that adds a cache layer.
// It also handles invalidation of the cache.
// It also handles the "touch" logic to mark tokens as used and update the "lastUsedAt" column in PG.
// Without the cache we would hit the DB for every request, with the cache we hit it only once (until a token is invalidated).
export function useCache(
  storagePromise: Promise<Storage>,
  redisConfig: {
    host: string;
    port: number;
    password?: string;
  },
  logger: FastifyLoggerInstance,
): {
  start(): Promise<void>;
  stop(): Promise<void>;
  readiness(): boolean;
  getStorage(): Promise<CacheStorage>;
} {
  let started = false;
  let cachedStoragePromise: Promise<CacheStorage> | null = null;
  let redisConnection: RedisInstance | null;

  function getStorage() {
    if (!cachedStoragePromise) {
      cachedStoragePromise = create();
    }

    return cachedStoragePromise;
  }

  const tracker = useActionTracker();

  async function create() {
    const storage = await storagePromise;
    const touch = useTokenTouchScheduler(storage, logger);

    redisConnection = new Redis({
      host: redisConfig.host,
      port: redisConfig.port,
      password: redisConfig.password,
      retryStrategy(times) {
        return Math.min(times * 500, 2000);
      },
      db: 0,
      enableReadyCheck: false,
    });

    redisConnection.on('error', err => {
      logger.error(err, 'Redis connection error');
    });

    redisConnection.on('connect', () => {
      logger.info('Redis connection established');
    });

    redisConnection.on('ready', async () => {
      logger.info('Redis connection ready... ');
    });

    redisConnection.on('close', () => {
      logger.info('Redis connection closed');
    });

    redisConnection.on('reconnecting', timeToReconnect => {
      logger.info('Redis reconnecting in %s', timeToReconnect);
    });

    redisConnection.on('end', async () => {
      logger.info('Redis ended - no more reconnections will be made');
      await stop();
    });

    // When there's a new token or a token was removed we need to invalidate the cache
    async function invalidateTokens(tokens: string[]) {
      cacheInvalidations.inc(1);

      if (redisConnection) {
        await redisConnection.del(...tokens.map(generateKey));
      }
    }

    // Thanks to the `atomic` function, every call to this function will only be executed once and Promise will be shared.
    // This is important because we don't want to make multiple requests to the DB for the same token, at the same time.
    const readTokenFromStorage = atomic(async function _readToken(token: string) {
      const item = await storage.readToken(token);

      if (redisConnection) {
        if (!item) {
          // If the token doesn't exist in the DB we still want to cache it for a short period of time to avoid hitting the DB again and again.
          await redisConnection.setex(generateKey(token), 60 /* seconds */, JSON.stringify(null));
        } else {
          await redisConnection.set(generateKey(token), JSON.stringify(item));
        }
      }

      return item;
    });

    // Thanks to the `atomic` function, every call to this function will only be executed once and Promise will be shared.
    // This is important because we don't want to make multiple requests to Redis for the same token, at the same time.
    const readTokenFromRedis = atomic(async function _readToken(
      hashed_token: string,
    ): Promise<StorageItem | null> {
      const item = await redisConnection?.get(generateKey(hashed_token));

      if (item === 'string') {
        return JSON.parse(item);
      }

      return null;
    });

    // TODO: add a in-memory fallback cache (in case Redis is down)

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
      async readToken(hashed_token, res) {
        // TODO: make sure we handle the case when redisConnection is null
        const cached = await readTokenFromRedis(hashed_token);

        if (cached) {
          cacheHits.inc(1);
          void res?.header('x-cache', 'HIT');
          // mark as used
          touch.schedule(hashed_token);
          return cached;
        }

        const item = await readTokenFromStorage(hashed_token);

        if (!item) {
          return null;
        }

        cacheMisses.inc(1);
        void res?.header('x-cache', 'MISS');

        touch.schedule(hashed_token); // mark as used

        return item;
      },
      writeToken: tracker.wrap(async item => {
        logger.debug('Writing token (target=%s)', item.target);
        const result = await storage.writeToken(item);
        if (redisConnection) {
          await redisConnection.set(generateKey(result.token), JSON.stringify(result));
        }

        return result;
      }),
      deleteToken: tracker.wrap(async hashed_token => {
        if (redisConnection) {
          await redisConnection.del(generateKey(hashed_token));
        }

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

    process.exit(0);
  }

  function readiness() {
    return started && !!redisConnection;
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
