import { FastifyLoggerInstance } from '@hive/service-common';
import LRU from 'tiny-lru';
import type { RateLimitApi, RateLimitQueryInput, RateLimitQueryOutput } from '@hive/rate-limit';
import { createTRPCClient } from '@trpc/client';
import { fetch } from '@whatwg-node/fetch';

export function createUsageRateLimit(config: { endpoint: string | null; logger: FastifyLoggerInstance }) {
  const logger = config.logger;

  if (!config.endpoint) {
    logger.warn(`Usage service is not configured to use rate-limit (missing config)`);

    return {
      async isRateLimited(_input: RateLimitQueryInput<'checkRateLimit'>): Promise<boolean> {
        return false;
      },
    };
  }
  const endpoint = config.endpoint.replace(/\/$/, '');
  const rateLimit = createTRPCClient<RateLimitApi>({
    url: `${endpoint}/trpc`,
    fetch,
  });
  const cache = LRU<Promise<RateLimitQueryOutput<'checkRateLimit'> | null>>(1000, 30_000);
  const retentionCache = LRU<Promise<RateLimitQueryOutput<'getRetention'> | null>>(1000, 30_000);

  async function fetchFreshRetentionInfo(
    input: RateLimitQueryInput<'getRetention'>
  ): Promise<RateLimitQueryOutput<'getRetention'> | null> {
    return rateLimit.query('getRetention', input);
  }

  async function fetchFreshLimitInfo(
    input: RateLimitQueryInput<'checkRateLimit'>
  ): Promise<RateLimitQueryOutput<'checkRateLimit'> | null> {
    return rateLimit.query('checkRateLimit', input);
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
    async isRateLimited(input: RateLimitQueryInput<'checkRateLimit'>): Promise<boolean> {
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
