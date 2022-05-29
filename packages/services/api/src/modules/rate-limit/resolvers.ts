import { RateLimitProvider } from './providers/rate-limit.provider';
import { RateLimitModule } from './__generated__/types';

export const resolvers: RateLimitModule.Resolvers = {
  Organization: {
    rateLimit: async (org, args, { injector }) => {
      let limitedForOperations = false;
      let limitedForSchemaPushes = false;

      try {
        const [operationsRateLimit, schemaPushLimit] = await Promise.all([
          injector.get(RateLimitProvider).checkRateLimit({
            entityType: 'organization',
            id: org.id,
            type: 'operations-reporting',
          }),
          injector.get(RateLimitProvider).checkRateLimit({
            entityType: 'organization',
            id: org.id,
            type: 'schema-push',
          }),
        ]);

        console.info('Fetched rate-limit info:', { orgId: org.id, operationsRateLimit, schemaPushLimit });
        limitedForOperations = operationsRateLimit.limited;
        limitedForSchemaPushes = schemaPushLimit.limited;
      } catch (e) {
        console.warn('Failed to fetch rate-limit info:', org.id, e);
      }

      return {
        limitedForOperations,
        limitedForSchemaPushes,
        operations: org.monthlyRateLimit.operations,
        schemaPushes: org.monthlyRateLimit.schemaPush,
        retentionInDays: org.monthlyRateLimit.retentionInDays,
      };
    },
  },
};
