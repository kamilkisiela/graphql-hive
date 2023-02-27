import { createClient, RouterClient } from 'fets';
import { Inject, Injectable, Scope } from 'graphql-modules';
import type { RateLimitApi, RateLimitApiInput } from '@hive/rate-limit';
import { HiveError } from '../../../shared/errors';
import { sentry } from '../../../shared/sentry';
import { Logger } from '../../shared/providers/logger';
import type { RateLimitServiceConfig } from './tokens';
import { RATE_LIMIT_SERVICE_CONFIG } from './tokens';

type CheckRateLimitInput = RateLimitApiInput['/check-rate-limit']['post']['json'];

@Injectable({
  global: true,
  scope: Scope.Singleton,
})
export class RateLimitProvider {
  private logger: Logger;
  private rateLimit: RouterClient<RateLimitApi> | null;

  constructor(
    logger: Logger,
    @Inject(RATE_LIMIT_SERVICE_CONFIG)
    rateLimitServiceConfig: RateLimitServiceConfig,
  ) {
    this.logger = logger.child({ service: 'RateLimitProvider' });
    this.rateLimit = rateLimitServiceConfig.endpoint
      ? createClient<RateLimitApi>({
          endpoint: rateLimitServiceConfig.endpoint,
        })
      : null;
  }

  async assertRateLimit(input: CheckRateLimitInput) {
    const limit = await this.checkRateLimit(input);

    if (limit.limited) {
      throw new HiveError(`Monthly limit for ${input.type} has reached!`);
    }

    return limit;
  }

  @sentry('RateLimitProvider.checkRateLimit')
  async checkRateLimit(input: CheckRateLimitInput) {
    if (this.rateLimit === null) {
      this.logger.warn(
        `Unable to check rate-limit for input: %o , service information is not available`,
        input,
      );

      return {
        limited: false,
        quota: 0,
        current: 0,
      };
    }

    this.logger.debug(`Checking rate limit for target id="${input.id}", type=${input.type}`);

    const response = await this.rateLimit['/check-rate-limit'].post({
      json: input,
    });
    return response.json();
  }
}
