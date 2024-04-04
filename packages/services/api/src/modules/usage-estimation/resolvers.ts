import { GraphQLError } from 'graphql';
import { AuthManager } from '../auth/providers/auth-manager';
import { OrganizationAccessScope } from '../auth/providers/organization-access';
import { ProjectManager } from '../project/providers/project-manager';
import { IdTranslator } from '../shared/providers/id-translator';
import { TargetManager } from '../target/providers/target-manager';
import { UsageEstimationModule } from './__generated__/types';
import { UsageEstimationProvider } from './providers/usage-estimation.provider';

export const resolvers: UsageEstimationModule.Resolvers = {
  Query: {
    async usageEstimation(_, args, { injector }) {
      const organizationId = await injector.get(IdTranslator).translateOrganizationId({
        organization: args.input.organization,
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
          }),
        )
      ).flat();

      const result = await injector.get(UsageEstimationProvider).estimateOperationsForTargets({
        targetIds: targets.map(target => target.id),
        month: args.input.month,
        year: args.input.year,
      });

      // TODO: once 006 migration is done, uncomment this
      // const result = await injector.get(UsageEstimationProvider).estimateOperationsForOrganization({
      //   organizationId: organizationId,
      //   month: args.input.month,
      //   year: args.input.year,
      // });

      if (!result && result !== 0) {
        throw new GraphQLError(`Failed to estimate usage, please try again later.`);
      }

      return {
        operations: result,
      };
    },
  },
};
