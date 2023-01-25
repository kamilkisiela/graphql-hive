import type { FastifyLoggerInstance } from 'fastify';
import ms from 'ms';
import LRU from 'tiny-lru';
import { metrics } from '@hive/service-common';
import { atomic, until, useActionTracker } from './helpers';
import type { Storage, StorageItem } from './storage';

const cacheHits = new metrics.Counter({
  name: 'tokens_cache_hits',
  help: 'Number of cache hits',
});

const cacheMisses = new metrics.Counter({
  name: 'tokens_cache_misses',
  help: 'Number of cache misses',
});

const cacheFillups = new metrics.Counter({
  name: 'tokens_cache_fillups',
  help: 'Number of cache fill ups',
});

const cacheInvalidations = new metrics.Counter({
  name: 'tokens_cache_invalidations',
  help: 'Number of cache invalidations',
});

// share "promises" to allow reduce the number of requests even more

interface CacheStorage extends Omit<Storage, 'touchTokens'> {
  invalidateTarget(target: string): void;
  invalidateProject(project: string): void;
  invalidateOrganization(organization: string): void;
}

// Cache is a wrapper around the storage that adds a cache layer.
// It also handles invalidation of the cache.
// It also handles the "touch" logic to mark tokens as used and update the "lastUsedAt" column in PG.
// Without the cache we would hit the DB for every request, with the cache we hit it only once (until a token is invalidated).
export function useCache(
  storagePromise: Promise<Storage>,
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

  async function create() {
    const storage = await storagePromise;
    // We might want to make this configurable in the future
    const cache = LRU<StorageItem[]>(500);
    const relations = useRelations();
    const touch = useTokenTouchScheduler(storage, logger, updateLastUsedAt);

    function updateLastUsedAt(token: string, date: Date) {
      const targetIds = cache.keys();

      for (const target of targetIds) {
        const items = cache.get(target);

        if (items) {
          const item = items.find(p => p.token === token);

          if (item) {
            item.lastUsedAt = date.getTime() as any;
            break;
          }
        }
      }
    }

    // When there's a new token or a token was removed we need to invalidate the cache for the related targets
    function invalidate(target: string): void {
      logger.debug('Invalidating (target=%s)', target);
      cacheInvalidations.inc(1);
      cache.delete(target);
    }

    // Reads the tokens (of a target) from the postgres db and cache them
    // Thanks to the `atomic` function, every call to this function will only be executed once
    // and the Promise will be shared (similar thing to the DataLoader).
    const readAndFill = atomic(async function _readAndFill(target: string) {
      const result = await storage.readTarget(target);

      logger.debug('Cache Fill (target=%s)', target);
      cacheFillups.inc(1);

      if (result.length) {
        const organization = result[0].organization;
        const project = result[0].project;

        // Connects a project to an organization
        relations.ensureOrganizationProject(organization, project);
        // Connects a target to a project
        relations.ensureProjectTarget(project, target);
      }

      cache.set(target, result);

      return result;
    });

    // Thanks to the `atomic` function, every call to this function will only be executed once and Promise will be shared.
    // This is important because we don't want to make multiple requests to the DB for the same token, at the same time.
    const readToken = atomic(async function _readToken(token: string) {
      return storage.readToken(token);
    });

    const cachedStorage: CacheStorage = {
      destroy() {
        return storage.destroy();
      },
      async readTarget(target, res) {
        const cachedValue = cache.get(target);
        if (cachedValue) {
          res?.header('x-cache', 'HIT'); // eslint-disable-line @typescript-eslint/no-floating-promises -- false positive, FastifyReply.then returns void
          cacheHits.inc(1);
          return cachedValue;
        }

        cacheMisses.inc(1);
        res?.header('x-cache', 'MISS'); // eslint-disable-line @typescript-eslint/no-floating-promises -- false positive, FastifyReply.then returns void

        return readAndFill(target);
      },
      invalidateTarget(target) {
        invalidate(target);
      },
      invalidateProject(project) {
        relations
          .getTargetsOfProject(project)
          .forEach(target => cachedStorage.invalidateTarget(target));
      },
      invalidateOrganization(organization) {
        relations
          .getTargetsOfOrganization(organization)
          .forEach(target => cachedStorage.invalidateTarget(target));
      },
      async readToken(hashed_token, res) {
        const targetIds = cache.keys();

        for (const target of targetIds) {
          const items = cache.get(target);

          if (items) {
            const item = items.find(p => p.token === hashed_token);

            if (item) {
              cacheHits.inc(1);
              res?.header('x-cache', 'HIT'); // eslint-disable-line @typescript-eslint/no-floating-promises -- false positive, FastifyReply.then returns void
              // mark as used
              touch.schedule(hashed_token);
              return item;
            }
          }
        }

        const item = await readToken(hashed_token);

        if (!item) {
          return null;
        }

        // Read the tokens of the target and cache them
        await readAndFill(item.target).catch(() => {});
        cacheMisses.inc(1);
        res?.header('x-cache', 'MISS'); // eslint-disable-line @typescript-eslint/no-floating-promises -- false positive, FastifyReply.then returns void

        touch.schedule(hashed_token); // mark as used

        return item;
      },
      writeToken: tracker.wrap(async item => {
        logger.debug('Writing token (target=%s)', item.target);
        const result = await storage.writeToken(item);
        invalidate(item.target);

        return result;
      }),
      deleteToken: tracker.wrap(async hashed_token => {
        const item = await cachedStorage.readToken(hashed_token);

        if (!item) {
          return;
        }

        invalidate(item.target);

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
    return started;
  }

  return {
    start,
    stop,
    readiness,
    getStorage,
  };
}

function useRelations() {
  const organizationToProjects = new Map<string, Set<string>>();
  const projectToTokens = new Map<string, Set<string>>();

  function getTargetsOfProject(project: string): Set<string> {
    return projectToTokens.get(project) ?? new Set();
  }

  function getProjectsOfOrganization(organization: string): Set<string> {
    return organizationToProjects.get(organization) ?? new Set();
  }

  function getTargetsOfOrganization(organization: string): Set<string> {
    const targets = new Set<string>();

    getProjectsOfOrganization(organization).forEach(project => {
      getTargetsOfProject(project).forEach(target => {
        targets.add(target);
      });
    });

    return targets;
  }

  function ensureRelation(from: string, to: string, mapSet: Map<string, Set<string>>) {
    if (!mapSet.has(from)) {
      mapSet.set(from, new Set());
    }

    mapSet.get(from)!.add(to);
  }

  function ensureOrganizationProject(organization: string, project: string) {
    ensureRelation(organization, project, organizationToProjects);
  }

  function ensureProjectTarget(project: string, target: string) {
    ensureRelation(project, target, projectToTokens);
  }

  return {
    ensureOrganizationProject,
    ensureProjectTarget,
    getTargetsOfProject,
    getTargetsOfOrganization,
  };
}

function useTokenTouchScheduler(
  storage: Storage,
  logger: FastifyLoggerInstance,
  onTouch: (token: string, date: Date) => void,
) {
  const scheduledTokens = new Map<string, Date>();

  /**
   * Mark token as used
   */
  function schedule(hashed_token: string): void {
    const now = new Date();
    scheduledTokens.set(hashed_token, now);
    onTouch(hashed_token, now);
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
    tokens.forEach(({ token, date }) => onTouch(token, date));
    storage.touchTokens(tokens).catch(error => {
      logger.error(error);
    });
  }, ms('10m'));

  function dispose() {
    clearInterval(interval);
  }

  return {
    schedule,
    dispose,
  };
}
