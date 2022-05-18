import { InjectionToken } from 'graphql-modules';

export interface RateLimitServiceConfig {
  endpoint: string | null;
}

export const RATE_LIMIT_SERVICE_CONFIG =
  new InjectionToken<RateLimitServiceConfig>('rate-limit-service-config');
