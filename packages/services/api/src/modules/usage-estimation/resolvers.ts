import { GraphQLError } from 'graphql';
import { parseDateRangeInput } from '../../shared/helpers';
import { AuthManager } from '../auth/providers/auth-manager';
import { OrganizationAccessScope } from '../auth/providers/organization-access';
import { IdTranslator } from '../shared/providers/id-translator';
import { UsageEstimationModule } from './__generated__/types';
import { UsageEstimationProvider } from './providers/usage-estimation.provider';

export const resolvers: UsageEstimationModule.Resolvers = {
  Query: {
    async usageEstimation(_, args, { injector }) {
      // THIS IS A BREAKING CHANGE, but I wanted to show how it would look like
      const organizationId = await injector.get(IdTranslator).translateOrganizationId({
        organization: args.input.organization,
      });

      await injector.get(AuthManager).ensureOrganizationAccess({
        organization: organizationId,
        scope: OrganizationAccessScope.SETTINGS,
      });

      const result = await injector.get(UsageEstimationProvider).estimateOperations({
        organizationId: organizationId,
        month: args.input.month,
        year: args.input.year,
      });

      if (!result && result !== 0) {
        throw new GraphQLError(`Failed to estimate usage, please try again later.`);
      }

      return {
        operations: result,
      };
    },
  },
};
