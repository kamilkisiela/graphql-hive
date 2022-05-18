import { RateLimitProvider } from './providers/rate-limit.provider';
import { RateLimitModule } from './__generated__/types';

export const resolvers: RateLimitModule.Resolvers = {
  Organization: {
    rateLimit: async (org, args, { injector }) => {
      let limitedForOperations = false;
      let limitedForSchemaPushes = false;

      try {
        const [organizationRateLimit, schemaPushLimit] = await Promise.all([
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

        limitedForOperations = organizationRateLimit.limited;
        limitedForSchemaPushes = schemaPushLimit.limited;
      } catch (e) {
        // nothing to do here
      }

      return {
        limitedForOperations,
        limitedForSchemaPushes,
        operations: org.monthlyRateLimit.operations,
        schemaPushes: org.monthlyRateLimit.schemaPush,
      };
    },
  },
};
