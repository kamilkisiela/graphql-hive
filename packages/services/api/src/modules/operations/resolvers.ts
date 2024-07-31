import { nsToMs, parseDateRangeInput } from '../../shared/helpers';
import { createConnection } from '../../shared/schema';
import { OperationsModule } from './__generated__/types';
import { OperationsManager } from './providers/operations-manager';

export const resolvers: OperationsModule.Resolvers = {
  DurationValues: {
    p75(value) {
      return transformPercentile(value.p75);
    },
    p90(value) {
      return transformPercentile(value.p90);
    },
    p95(value) {
      return transformPercentile(value.p95);
    },
    p99(value) {
      return transformPercentile(value.p99);
    },
  },
  OperationStatsValuesConnection: createConnection(),
  ClientStatsValuesConnection: createConnection(),
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

function transformPercentile(value: number | null): number {
  return value ? Math.round(nsToMs(value)) : 0;
}
