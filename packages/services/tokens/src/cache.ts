import type { FastifyLoggerInstance } from 'fastify';
import Redis, { Redis as RedisInstance } from 'ioredis';
import ms from 'ms';
import { metrics } from '@hive/service-common';
import { atomic, until, useActionTracker } from './helpers';
import type { Storage } from './storage';

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

// share "promises" to allow reduce the number of requests even more

interface CacheStorage extends Omit<Storage, 'touchTokens'> {
  invalidateTarget(target: string): Promise<void>;
  invalidateProject(project: string, targets: string[]): Promise<void>;
  invalidateOrganization(organization: string, projects: string[], target: string[]): Promise<void>;
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
    password: string;
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
    async function invalidateByTags(tags: string[]) {
      cacheInvalidations.inc(1);
      console.log('invalidate:', tags.join(', '));

      if (redisConnection) {
        const keys = (await Promise.all(tags.map(tag => redisConnection!.smembers(tag)))).flat(1);
        const pipeline = redisConnection.pipeline();

        for (const key of keys) {
          pipeline.del(key);
        }

        for (const tag of tags) {
          pipeline.del(tag);
        }

        await pipeline.exec();
      }
    }

    // Thanks to the `atomic` function, every call to this function will only be executed once and Promise will be shared.
    // This is important because we don't want to make multiple requests to the DB for the same token, at the same time.
    const readTokenFromStorage = atomic(async function _readToken(token: string) {
      return storage.readToken(token);
    });

    // Thanks to the `atomic` function, every call to this function will only be executed once and Promise will be shared.
    // This is important because we don't want to make multiple requests to Redis for the same token, at the same time.
    const readTokenFromRedis = atomic(async function _readToken(hashed_token: string) {
      return redisConnection?.get(`token:${hashed_token}`);
    });

    // TODO: add a in-memory fallback cache (in case Redis is down)

    const cachedStorage: CacheStorage = {
      destroy() {
        return storage.destroy();
      },
      async readTarget(target) {
        return storage.readTarget(target);
      },
      async invalidateTarget(target) {
        logger.debug('Invalidating (target=%s)', target);
        await invalidateByTags([`target:${target}`]);
      },
      async invalidateProject(project, targets) {
        logger.debug('Invalidating (project=%s)', project);
        await invalidateByTags([`project:${project}`, ...targets.map(t => `target:${t}`)]);
      },
      async invalidateOrganization(organization, projects, targets) {
        logger.debug('Invalidating (organization=%s)', organization);
        await invalidateByTags([
          `organization:${organization}`,
          ...projects.map(p => `project:${p}`),
          ...targets.map(t => `target:${t}`),
        ]);
      },
      async readToken(hashed_token, res) {
        // TODO: make sure we handle the case when redisConnection is null
        const cached = await readTokenFromRedis(hashed_token);

        if (cached) {
          cacheHits.inc(1);
          res?.header('x-cache', 'HIT'); // eslint-disable-line @typescript-eslint/no-floating-promises -- false positive, FastifyReply.then returns void
          // mark as used
          touch.schedule(hashed_token);
          return JSON.parse(cached);
        }

        const item = await readTokenFromStorage(hashed_token);

        if (!item) {
          return null;
        }

        cacheMisses.inc(1);
        res?.header('x-cache', 'MISS'); // eslint-disable-line @typescript-eslint/no-floating-promises -- false positive, FastifyReply.then returns void

        touch.schedule(hashed_token); // mark as used

        return item;
      },
      writeToken: tracker.wrap(async item => {
        logger.debug('Writing token (target=%s)', item.target);
        const result = await storage.writeToken(item);
        // no need to invalidate the cache, just add the token to Redis
        if (redisConnection) {
          const key = `token:${result.token}`;
          await redisConnection
            .multi()
            // tags
            .sadd(`organization:${item.organization}`, key)
            .sadd(`project:${item.project}`, key)
            .sadd(`target:${item.target}`, key)
            // token record
            .set(key, JSON.stringify(result))
            .exec();
        }

        return result;
      }),
      deleteToken: tracker.wrap(async hashed_token => {
        const item = await cachedStorage.readToken(hashed_token);

        if (!item) {
          return;
        }

        if (redisConnection) {
          const key = `token:${item.token}`;
          await redisConnection
            .multi()
            // tags
            .srem(`organization:${item.organization}`, key)
            .srem(`project:${item.project}`, key)
            .srem(`target:${item.target}`, key)
            // token record
            .del(key)
            .exec();
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
