import { RateLimitProvider } from './providers/rate-limit.provider';
import { RateLimitModule } from './__generated__/types';

export const resolvers: RateLimitModule.Resolvers = {
  Organization: {
    rateLimit: async (org, args, { injector }) => {
      let limitedForOperations = false;

      try {
        const operationsRateLimit = await injector.get(RateLimitProvider).checkRateLimit({
          entityType: 'organization',
          id: org.id,
          type: 'operations-reporting',
        });

        console.info('Fetched rate-limit info:', { orgId: org.id, operationsRateLimit });
        limitedForOperations = operationsRateLimit.limited;
      } catch (e) {
        console.warn('Failed to fetch rate-limit info:', org.id, e);
      }

      return {
        limitedForOperations,
        operations: org.monthlyRateLimit.operations,
        retentionInDays: org.monthlyRateLimit.retentionInDays,
      };
    },
  },
};
