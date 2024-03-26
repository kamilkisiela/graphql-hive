import LRU from 'tiny-lru';
import type { RateLimitApi, RateLimitApiOutput } from '@hive/rate-limit';
import { ServiceLogger } from '@hive/service-common';
import { createTRPCProxyClient, httpLink } from '@trpc/client';

export function createUsageRateLimit(config: {
  cacheTtl: number;
  endpoint: string | null;
  logger: ServiceLogger;
}) {
  const logger = config.logger;

  if (!config.endpoint) {
    logger.warn(`Usage service is not configured to use rate-limit (missing config)`);

    return {
      async isRateLimited(_targetId: string): Promise<boolean> {
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
        headers: {
          'x-requesting-service': 'usage',
        },
      }),
    ],
  });
  const rateLimitCache = LRU<RateLimitApiOutput['checkRateLimitForTarget']>(1000, config.cacheTtl);
  const retentionCache = LRU<RateLimitApiOutput['getRetention']>(1000, config.cacheTtl);

  return {
    async getRetentionForTargetId(targetId: string) {
      const retentionResponse = retentionCache.get(targetId);

      if (!retentionResponse) {
        const result = await rateLimit.getRetention.query({
          targetId,
        });

        if (result) {
          retentionCache.set(targetId, result);

          return result;
        }

        return null;
      }

      return retentionResponse;
    },
    async isRateLimited(targetId: string): Promise<boolean> {
      const limitInfo = rateLimitCache.get(targetId);

      if (!limitInfo) {
        const result = await rateLimit.checkRateLimitForTarget.query({
          targetId,
        });

        if (result) {
          rateLimitCache.set(targetId, result);

          return result !== null && result.limited;
        }

        return false;
      }

      return limitInfo.limited;
    },
  };
}
