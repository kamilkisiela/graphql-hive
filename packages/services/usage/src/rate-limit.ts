import { createClient } from 'fets';
import LRU from 'tiny-lru';
import type { RateLimitApi, RateLimitApiInput, RateLimitApiOutput } from '@hive/rate-limit';
import { FastifyLoggerInstance } from '@hive/service-common';

type CheckRateLimitInput = RateLimitApiInput['/check-rate-limit']['post']['json'];
type CheckRateLimitResponse = RateLimitApiOutput['/check-rate-limit']['post'][200];
type GetRetentionInput = RateLimitApiInput['/retention']['post']['json'];
type GetRetentionResponse = RateLimitApiOutput['/retention']['post'][200];

export function createUsageRateLimit(config: {
  endpoint: string | null;
  logger: FastifyLoggerInstance;
}) {
  const logger = config.logger;

  if (!config.endpoint) {
    logger.warn(`Usage service is not configured to use rate-limit (missing config)`);

    return {
      async isRateLimited(_input: CheckRateLimitInput): Promise<boolean> {
        return false;
      },
    };
  }
  const endpoint = config.endpoint.replace(/\/$/, '');
  const rateLimit = createClient<RateLimitApi>({
    endpoint,
  });
  const cache = LRU<Promise<CheckRateLimitResponse | null>>(1000, 30_000);
  const retentionCache = LRU<Promise<GetRetentionResponse | null>>(1000, 30_000);

  async function fetchFreshRetentionInfo(input: GetRetentionInput) {
    return rateLimit['/retention'].post({
      json: input,
    });
  }

  async function fetchFreshLimitInfo(input: CheckRateLimitInput) {
    return rateLimit['/check-rate-limit'].post({
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
    async isRateLimited(input: CheckRateLimitInput): Promise<boolean> {
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
