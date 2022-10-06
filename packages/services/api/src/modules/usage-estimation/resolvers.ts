import { GraphQLError } from 'graphql';
import { parseDateRangeInput } from '../../shared/helpers';
import { AuthManager } from '../auth/providers/auth-manager';
import { OrganizationAccessScope } from '../auth/providers/organization-access';
import { ProjectManager } from '../project/providers/project-manager';
import { IdTranslator } from '../shared/providers/id-translator';
import { TargetManager } from '../target/providers/target-manager';
import { UsageEstimationProvider } from './providers/usage-estimation.provider';
import { UsageEstimationModule } from './__generated__/types';

export const resolvers: UsageEstimationModule.Resolvers = {
  Query: {
    async usageEstimation(root, args) {
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

      const projects = await injector.get(ProjectManager).getProjects({
        organization: organizationId,
      });

      const targets = (
        await Promise.all(
          projects.map(project => {
            return injector.get(TargetManager).getTargets({
              organization: organizationId,
              project: project.id,
            });
          })
        )
      ).flat();

      return {
        ...range,
        targets: targets.map(t => t.id),
      };
    },
  },
  UsageEstimation: {
    operations: async (params, args, { injector }) => {
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
