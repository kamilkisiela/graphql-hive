import { Logger } from '../../shared/providers/logger';
import { RateLimitProvider } from '../providers/rate-limit.provider';
import type { OrganizationResolvers } from './../../../__generated__/types.next';

export const Organization: Pick<OrganizationResolvers, 'rateLimit' | '__isTypeOf'> = {
  rateLimit: async (org, _args, { injector }) => {
    let limitedForOperations = false;
    const logger = injector.get(Logger);

    try {
      const operationsRateLimit = await injector.get(RateLimitProvider).checkRateLimit({
        entityType: 'organization',
        id: org.id,
        type: 'operations-reporting',
        token: null,
      });

      logger.debug('Fetched rate-limit info:', { orgId: org.id, operationsRateLimit });
      limitedForOperations = operationsRateLimit.usagePercentage >= 1;
    } catch (e) {
      logger.error('Failed to fetch rate-limit info:', org.id, e);
    }

    return {
      limitedForOperations,
      operations: org.monthlyRateLimit.operations,
      retentionInDays: org.monthlyRateLimit.retentionInDays,
    };
  },
};
