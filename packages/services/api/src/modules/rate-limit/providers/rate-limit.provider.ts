import { Inject, Injectable, Scope } from 'graphql-modules';
import { sentry } from '../../../shared/sentry';
import { Logger } from '../../shared/providers/logger';
import { RATE_LIMIT_SERVICE_CONFIG } from './tokens';
import type { RateLimitServiceConfig } from './tokens';
import type { RateLimitApi, RateLimitQueryInput } from '@hive/rate-limit';
import { createTRPCClient } from '@trpc/client';
import { fetch } from '@whatwg-node/fetch';
import { HiveError } from '../../../shared/errors';

@Injectable({
  global: true,
  scope: Scope.Singleton,
})
export class RateLimitProvider {
  private logger: Logger;
  private rateLimit;

  constructor(
    logger: Logger,
    @Inject(RATE_LIMIT_SERVICE_CONFIG)
    rateLimitServiceConfig: RateLimitServiceConfig
  ) {
    this.logger = logger.child({ service: 'RateLimitProvider' });
    this.rateLimit = rateLimitServiceConfig.endpoint
      ? createTRPCClient<RateLimitApi>({
          url: `${rateLimitServiceConfig.endpoint}/trpc`,
          fetch,
        })
      : null;
  }

  async assertRateLimit(input: RateLimitQueryInput<'checkRateLimit'>) {
    const limit = await this.checkRateLimit(input);

    if (limit.limited) {
      throw new HiveError(`Monthly limit for ${input.type} has reached!`);
    }

    return limit;
  }

  @sentry('RateLimitProvider.checkRateLimit')
  async checkRateLimit(input: RateLimitQueryInput<'checkRateLimit'>) {
    if (this.rateLimit === null) {
      this.logger.warn(`Unable to check rate-limit for input: %o , service information is not available`, input);

      return {
        limited: false,
      };
    }

    this.logger.debug(`Checking rate limit for target id="${input.id}", type=${input.type}`);

    return await this.rateLimit.query('checkRateLimit', input);
  }
}
