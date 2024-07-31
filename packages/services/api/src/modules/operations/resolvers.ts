import { parseDateRangeInput } from '../../shared/helpers';
import { OperationsModule } from './__generated__/types';
import { OperationsManager } from './providers/operations-manager';

export const resolvers: OperationsModule.Resolvers = {
  OrganizationGetStarted: {
    async reportingOperations(organization, _, { injector }) {
      if (organization.reportingOperations === true) {
        return organization.reportingOperations;
      }

      return injector.get(OperationsManager).hasOperationsForOrganization({
        organization: organization.id,
      });
    },
  },
  Project: {
    totalRequests(project, { period }, { injector }) {
      return injector.get(OperationsManager).countRequestsOfProject({
        project: project.id,
        organization: project.orgId,
        period: parseDateRangeInput(period),
      });
    },
    requestsOverTime(project, { resolution, period }, { injector }) {
      return injector.get(OperationsManager).readRequestsOverTimeOfProject({
        project: project.id,
        organization: project.orgId,
        period: parseDateRangeInput(period),
        resolution,
      });
    },
  },
  Target: {
    totalRequests(target, { period }, { injector }) {
      return injector.get(OperationsManager).countRequests({
        target: target.id,
        project: target.projectId,
        organization: target.orgId,
        period: parseDateRangeInput(period),
      });
    },
    async requestsOverTime(target, { resolution, period }, { injector }) {
      const result = await injector.get(OperationsManager).readRequestsOverTimeOfTargets({
        project: target.projectId,
        organization: target.orgId,
        targets: [target.id],
        period: parseDateRangeInput(period),
        resolution,
      });

      return result[target.id] ?? [];
    },
    operation(target, args, { injector }) {
      return injector.get(OperationsManager).getOperation({
        hash: args.hash,
        organization: target.orgId,
        project: target.projectId,
        target: target.id,
      });
    },
  },
};
