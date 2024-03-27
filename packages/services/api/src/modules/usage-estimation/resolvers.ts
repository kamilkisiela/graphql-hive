import { GraphQLError } from 'graphql';
import { parseDateRangeInput } from '../../shared/helpers';
import { AuthManager } from '../auth/providers/auth-manager';
import { OrganizationAccessScope } from '../auth/providers/organization-access';
import { OrganizationManager } from '../organization/providers/organization-manager';
import { IdTranslator } from '../shared/providers/id-translator';
import { UsageEstimationModule } from './__generated__/types';
import { UsageEstimationProvider } from './providers/usage-estimation.provider';

export const resolvers: UsageEstimationModule.Resolvers = {
  Query: {
    async usageEstimation(_, args) {
      const parsedRange = parseDateRangeInput(args.range);

      return {
        startTime: parsedRange.from,
        endTime: parsedRange.to,
      };
    },
  },
  UsageEstimationScope: {
    async target(range, args, { injector }) {
      const targetId = await injector.get(IdTranslator).translateTargetId({
        organization: args.selector.organization,
        project: args.selector.project,
        target: args.selector.target,
      });

      return {
        ...range,
        targets: [targetId],
      };
    },
    async org(range, args, { injector }) {
      const organizationId = await injector.get(IdTranslator).translateOrganizationId({
        organization: args.selector.organization,
      });
      await injector.get(AuthManager).ensureOrganizationAccess({
        organization: organizationId,
        scope: OrganizationAccessScope.SETTINGS,
      });

      const organization = await injector.get(OrganizationManager).getOrganization({
        organization: organizationId,
      });

      return {
        ...range,
        targets: organization.createdTargetIds,
      };
    },
  },
  UsageEstimation: {
    operations: async (params, _, { injector }) => {
      const result = await injector.get(UsageEstimationProvider).estimateOperations({
        targetIds: params.targets,
        endTime: params.endTime.toString(),
        startTime: params.startTime.toString(),
      });

      if (!result && result !== 0) {
        throw new GraphQLError(`Failed to estimate usage, please try again later.`);
      }

      return result;
    },
  },
};
