import { BentoCache, bentostore } from 'bentocache';
import { memoryDriver } from 'bentocache/drivers/memory';
import { redisBusDriver, redisDriver } from 'bentocache/drivers/redis';
import type { RedisOptions } from 'ioredis';
import type { ServiceLogger } from '@hive/service-common';
import { tokenCacheHits, tokenRequests } from './metrics';

// import { cacheHits, cacheMisses } from './metrics';

export enum TokenStatus {
  NotFound,
  NoAccess,
}

export type TokensResponse = {
  organization: string;
  project: string;
  target: string;
  scopes: readonly string[];
};

type Token = TokensResponse | TokenStatus;

export function createTokens(config: { redisConnection: RedisOptions; logger: ServiceLogger }) {
  const logger = config.logger.child({ source: 'tokens' });
  // const scheduledTokens = new Map<string, Date>();
  const cache = new BentoCache({
    default: 'multitier',
    prefix: 'tokens',
    logger,
    gracePeriod: {
      enabled: true,
      // In case Redis is down, the token from the in-memory cache
      // will be valid for 6 hours.
      duration: '6h',
      // To avoid keep spamming Redis,
      // the stale cache entry is considered valid for 5m.
      // Requests for the same cache entry will serve the same stale data
      // for 5 minutes.
      // Prevents overwhelming Redis with multiple calls
      // while it's down or overloaded.
      fallbackDuration: '5m',
    },
    stores: {
      multitier: bentostore()
        // Your L1 Cache. Here, an in-memory cache with
        // a maximum size of 100Mb
        .useL1Layer(memoryDriver({ maxSize: 100 * 1024 * 1024 }))
        // Your L2 Cache. Here, a Redis cache
        .useL2Layer(redisDriver({ connection: config.redisConnection }))
        // Finally, the bus to synchronize the L1 caches between
        // the different instances of your application
        .useBus(redisBusDriver({ connection: config.redisConnection })),
    },
  });

  cache.on('bus:message:received', arg => {
    logger.debug('Received message', arg);
  });

  // // updated every 10m
  // const interval = setInterval(
  //   traceInlineSync('Touch Tokens', {}, () => {
  //     if (!scheduledTokens.size) {
  //       return;
  //     }

  //     const tokens = Array.from(scheduledTokens.entries()).map(([token, date]) => ({
  //       token,
  //       date,
  //     }));
  //     scheduledTokens.clear();

  //     config.logger.debug(`Touch ${tokens.length} tokens`);
  //     storage.touchTokens(tokens).catch(error => {
  //       logger.error(error);
  //     });
  //   }),
  //   ms('60s'),
  // );

  // function dispose() {
  //   clearInterval(interval);
  // }

  // /**
  //  * Mark token as used
  //  */
  // function schedule(hashedToken: string): void {
  //   const now = new Date();
  //   scheduledTokens.set(hashedToken, now);
  // }

  cache.on('cache:hit', () => {
    tokenCacheHits.inc();
  });

  async function getToken(token: string) {
    try {
      // TODO: update lastUsedAt periodically
      const info = await cache.get<{
        organization: string;
        project: string;
        target: string;
        scopes: readonly string[];
      }>(token);

      if (info) {
        const result = info.scopes.includes('target:registry:write')
          ? {
              target: info.target,
              project: info.project,
              organization: info.organization,
              scopes: info.scopes,
            }
          : TokenStatus.NoAccess;
        return result;
      }
      return TokenStatus.NotFound;
    } catch (error) {
      return TokenStatus.NotFound;
    }
  }

  return {
    async fetch(token: string) {
      tokenRequests.inc();
      const tokenInfo = await getToken(token);
      return tokenInfo ?? TokenStatus.NotFound;
    },
    dispose() {
      return cache.disconnect();
    },
    isNotFound(token: Token): token is TokenStatus.NotFound {
      return token === TokenStatus.NotFound;
    },
    isNoAccess(token: Token): token is TokenStatus.NoAccess {
      return token === TokenStatus.NoAccess;
    },
  };
}
