import { endOfMonth, startOfMonth } from 'date-fns';
import { Inject, Injectable, Scope } from 'graphql-modules';
import LRU from 'lru-cache';
import type { RateLimitApi, RateLimitApiInput } from '@hive/rate-limit';
import { createTRPCProxyClient, httpLink } from '@trpc/client';
import { Logger } from '../../shared/providers/logger';
import type { RateLimitServiceConfig } from './tokens';
import { RATE_LIMIT_SERVICE_CONFIG } from './tokens';

const RETENTION_CACHE_TTL_IN_SECONDS = 120;

@Injectable({
  global: true,
  scope: Scope.Singleton,
})
export class RateLimitProvider {
  private logger: Logger;
  private rateLimit;
  private retentionCache = new LRU<string, number>({
    max: 500,
    ttl: RETENTION_CACHE_TTL_IN_SECONDS * 1000,
    stale: false,
  });

  constructor(
    logger: Logger,
    @Inject(RATE_LIMIT_SERVICE_CONFIG)
    rateLimitServiceConfig: RateLimitServiceConfig,
  ) {
    this.logger = logger.child({ service: 'RateLimitProvider' });
    this.rateLimit = rateLimitServiceConfig.endpoint
      ? createTRPCProxyClient<RateLimitApi>({
          links: [
            httpLink({
              url: `${rateLimitServiceConfig.endpoint}/trpc`,
              fetch,
            }),
          ],
        })
      : null;
  }

  async checkRateLimit(input: RateLimitApiInput['checkRateLimitForOrganization']) {
    if (this.rateLimit === null) {
      this.logger.warn(
        `Unable to check rate-limit for input: %o , service information is not available`,
        input,
      );

      return {
        usagePercentage: 0,
        limited: false,
        quota: 0,
        current: 0,
      };
    }

    this.logger.debug(`Checking rate limit for org id="${input.organizationId}"...`);

    return await this.rateLimit.checkRateLimitForOrganization.query(input);
  }

  async getWindow(dayOfMonth: number): Promise<{
    start: Date;
    end: Date;
  }> {
    if (this.rateLimit === null) {
      return {
        start: startOfMonth(new Date()),
        end: endOfMonth(new Date()),
      };
    }

    const window = await this.rateLimit.calculateWindow.query({
      cycleDay: dayOfMonth,
    });

    return {
      start: new Date(window.start),
      end: new Date(window.end),
    };
  }

  async onNewTargetCreated() {
    if (this.rateLimit === null) {
      return;
    }

    await this.rateLimit.invalidateCache.mutate();
  }

  async getRetention(input: RateLimitApiInput['getRetention']) {
    if (this.rateLimit === null) {
      return null;
    }

    if (this.retentionCache.has(input.targetId)) {
      return this.retentionCache.get(input.targetId);
    }

    this.logger.debug(`Fetching retention for target id="${input.targetId}"`);

    const value = await this.rateLimit.getRetention.query(input);
    this.retentionCache.set(input.targetId, value);

    return value;
  }
}
