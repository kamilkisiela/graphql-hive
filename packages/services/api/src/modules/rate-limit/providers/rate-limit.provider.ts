import { Inject, Injectable, Scope } from 'graphql-modules';
import type { RateLimitApi, RateLimitApiInput } from '@hive/rate-limit';
import { createTRPCProxyClient, httpLink } from '@trpc/client';
import { fetch } from '@whatwg-node/fetch';
import { HiveError } from '../../../shared/errors';
import { sentry } from '../../../shared/sentry';
import { Logger } from '../../shared/providers/logger';
import type { RateLimitServiceConfig } from './tokens';
import { RATE_LIMIT_SERVICE_CONFIG } from './tokens';

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

  @sentry('RateLimitProvider.checkRateLimit')
  async checkRateLimit(input: RateLimitApiInput['checkRateLimit']) {
    if (this.rateLimit === null) {
      this.logger.warn(
        `Unable to check rate-limit for input: %o , service information is not available`,
        input,
      );

      return {
        usagePercenrage: 0,
        limited: false,
      };
    }

    this.logger.debug(`Checking rate limit for target id="${input.id}", type=${input.type}`);

    return await this.rateLimit.checkRateLimit.query(input);
  }
}
