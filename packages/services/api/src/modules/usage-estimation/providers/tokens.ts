import { InjectionToken } from 'graphql-modules';

export interface UsageEstimationServiceConfig {
  endpoint: string | null;
}

export const USAGE_ESTIMATION_SERVICE_CONFIG =
  new InjectionToken<UsageEstimationServiceConfig>(
    'usage-estimation-service-config'
  );
