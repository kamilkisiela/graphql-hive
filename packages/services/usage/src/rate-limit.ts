import { createClient } from 'fets';
import LRU from 'tiny-lru';
import type { RateLimitApi, RateLimitApiInput, RateLimitApiOutput } from '@hive/rate-limit';
import { FastifyLoggerInstance } from '@hive/service-common';

export function createUsageRateLimit(config: {
  endpoint: string | null;
  logger: FastifyLoggerInstance;
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
  const rateLimit = createClient<RateLimitApi>({
    endpoint,
  });
  const cache = LRU<Promise<RateLimitApiOutput['checkRateLimit'] | null>>(1000, 30_000);
  const retentionCache = LRU<Promise<RateLimitApiOutput['getRetention'] | null>>(1000, 30_000);

  async function fetchFreshRetentionInfo(input: RateLimitApiInput['getRetention']) {
    return rateLimit.getRetention.post({
      json: input,
    });
  }

  async function fetchFreshLimitInfo(input: RateLimitApiInput['checkRateLimit']) {
    return rateLimit.checkRateLimit.post({
      json: input,
    });
  }

  return {
    async getRetentionForTargetId(targetId: string) {
      const retentionResponse = await retentionCache.get(targetId);

      if (!retentionResponse) {
        const result = fetchFreshRetentionInfo({ targetId }).then(r => r.json());

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
        const result = fetchFreshLimitInfo(input).then(r => r.json());

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
