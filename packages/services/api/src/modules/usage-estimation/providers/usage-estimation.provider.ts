import type { UsageEstimatorApi, UsageEstimatorQueryInput } from '@hive/usage-estimator';
import { createTRPCClient } from '@trpc/client';
import { Inject, Injectable, Scope } from 'graphql-modules';
import { sentry } from '../../../shared/sentry';
import { Logger } from '../../shared/providers/logger';
import type { UsageEstimationServiceConfig } from './tokens';
import { USAGE_ESTIMATION_SERVICE_CONFIG } from './tokens';
import { fetch } from '@whatwg-node/fetch';

@Injectable({
  scope: Scope.Singleton,
})
export class UsageEstimationProvider {
  private logger: Logger;
  private usageEstimator;

  constructor(
    logger: Logger,
    @Inject(USAGE_ESTIMATION_SERVICE_CONFIG)
    usageEstimationConfig: UsageEstimationServiceConfig
  ) {
    this.logger = logger.child({ service: 'UsageEstimationProvider' });
    this.usageEstimator = usageEstimationConfig.endpoint
      ? createTRPCClient<UsageEstimatorApi>({
          url: `${usageEstimationConfig.endpoint}/trpc`,
          fetch,
        })
      : null;
  }

  @sentry('UsageEstimation.estimateOperations')
  async estimateOperations(input: UsageEstimatorQueryInput<'estimateOperationsForTarget'>): Promise<number | null> {
    this.logger.debug('Estimation operations, input: %o', input);

    if (input.targetIds.length === 0) {
      return 0;
    }

    if (!this.usageEstimator) {
      this.logger.warn('Usage estimator is not available due to missing configuration');

      return null;
    }

    const result = await this.usageEstimator.query('estimateOperationsForTarget', input);

    return result.totalOperations;
  }
}
