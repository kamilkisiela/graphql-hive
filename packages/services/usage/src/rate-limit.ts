import LRU from 'tiny-lru';
import type { RateLimitApi, RateLimitApiInput, RateLimitApiOutput } from '@hive/rate-limit';
import { FastifyLoggerInstance } from '@hive/service-common';
import { createTRPCProxyClient, httpLink } from '@trpc/client';
import { fetch } from '@whatwg-node/fetch';

export function createUsageRateLimit(config: {
  endpoint: string | null;
  logger: FastifyLoggerInstance;
  cacheTTLInMs: number;
}) {
  const logger = config.logger;

  if (!config.endpoint) {
    logger.warn(`Usage service is not configured to use rate-limit (missing config)`);

    return {
      async isRateLimited(_input: RateLimitApiInput['checkRateLimit']): Promise<boolean> {
        return false;
      },
    };
  }
  const endpoint = config.endpoint.replace(/\/$/, '');
  const rateLimit = createTRPCProxyClient<RateLimitApi>({
    links: [
      httpLink({
        url: `${endpoint}/trpc`,
        fetch,
      }),
    ],
  });
  const cache = LRU<Promise<RateLimitApiOutput['checkRateLimit'] | null>>(
    1000,
    config.cacheTTLInMs,
  );
  const retentionCache = LRU<Promise<RateLimitApiOutput['getRetention'] | null>>(
    1000,
    config.cacheTTLInMs,
  );

  async function fetchFreshRetentionInfo(input: RateLimitApiInput['getRetention']) {
    return rateLimit.getRetention.query(input);
  }

  async function fetchFreshLimitInfo(input: RateLimitApiInput['checkRateLimit']) {
    return rateLimit.checkRateLimit.query(input);
  }

  return {
    async getRetentionForTargetId(targetId: string) {
      const retentionResponse = await retentionCache.get(targetId);

      if (!retentionResponse) {
        const result = fetchFreshRetentionInfo({ targetId });

        if (result) {
          retentionCache.set(targetId, result);

          return result;
        }

        return null;
      }

      return retentionResponse;
    },
    async isRateLimited(input: RateLimitApiInput['checkRateLimit']): Promise<boolean> {
      const limitInfo = await cache.get(input.id);

      if (!limitInfo) {
        const result = fetchFreshLimitInfo(input);

        if (result) {
          cache.set(input.id, result);

          return result.then(r => r !== null && r.limited);
        }

        return false;
      }

      return limitInfo.limited;
    },
  };
}
