import { hash, nsToMs, parseDateRangeInput } from '../../shared/helpers';
import { createConnection } from '../../shared/schema';
import { OperationsModule } from './__generated__/types';
import { OperationsManager } from './providers/operations-manager';

export const resolvers: OperationsModule.Resolvers = {
  ClientStats: {
    totalRequests({ organization, project, target, period, clientName }, _, { injector }) {
      return injector.get(OperationsManager).countRequestsAndFailures({
        organization,
        project,
        target,
        period,
        clients: clientName === 'unknown' ? ['unknown', ''] : [clientName],
      });
    },
    totalVersions({ organization, project, target, period, clientName }, _, { injector }) {
      return injector.get(OperationsManager).countClientVersions({
        organization,
        project,
        target,
        period,
        clientName,
      });
    },
    requestsOverTime(
      { organization, project, target, period, clientName },
      { resolution },
      { injector },
    ) {
      return injector.get(OperationsManager).readRequestsOverTime({
        target,
        project,
        organization,
        period,
        resolution,
        clients: clientName === 'unknown' ? ['unknown', ''] : [clientName],
      });
    },
    async operations({ organization, project, target, period, clientName }, args, { injector }) {
      const operationsManager = injector.get(OperationsManager);
      const [operations, durations] = await Promise.all([
        operationsManager.readOperationsStats({
          organization,
          project,
          target,
          period,
          clients: clientName === 'unknown' ? ['unknown', ''] : [clientName],
        }),
        operationsManager.readDetailedDurationPercentiles({
          organization,
          project,
          target,
          period,
          clients: clientName === 'unknown' ? ['unknown', ''] : [clientName],
        }),
      ]);

      return operations
        .map(op => {
          return {
            id: hash(`${op.operationName}__${op.operationHash}`),
            kind: op.kind,
            name: op.operationName,
            count: op.count,
            countOk: op.countOk,
            percentage: op.percentage,
            duration: durations.get(op.operationHash)!,
            operationHash: op.operationHash,
          };
        })
        .sort((a, b) => b.count - a.count);
    },
    async versions({ organization, project, target, period, clientName }, { limit }, { injector }) {
      return injector.get(OperationsManager).readClientVersions({
        target,
        project,
        organization,
        period,
        clientName,
        limit,
      });
    },
  },
  OperationsStats: {
    async operations(
      { organization, project, target, period, operations: operationsFilter, clients },
      args,
      { injector },
    ) {
      const operationsManager = injector.get(OperationsManager);
      const [operations, durations] = await Promise.all([
        operationsManager.readOperationsStats({
          organization,
          project,
          target,
          period,
          operations: operationsFilter,
          clients,
        }),
        operationsManager.readDetailedDurationPercentiles({
          organization,
          project,
          target,
          period,
          operations: operationsFilter,
          clients,
        }),
      ]);

      return operations
        .map(op => {
          return {
            id: hash(`${op.operationName}__${op.operationHash}`),
            kind: op.kind,
            name: op.operationName,
            count: op.count,
            countOk: op.countOk,
            percentage: op.percentage,
            duration: durations.get(op.operationHash)!,
            operationHash: op.operationHash,
          };
        })
        .sort((a, b) => b.count - a.count);
    },
    totalRequests({ organization, project, target, period, operations, clients }, _, { injector }) {
      return injector.get(OperationsManager).countRequestsAndFailures({
        organization,
        project,
        target,
        period,
        operations,
        clients,
      });
    },
    totalFailures(
      { organization, project, target, period, operations: operationsFilter, clients },
      _,
      { injector },
    ) {
      return injector.get(OperationsManager).countFailures({
        organization,
        project,
        target,
        period,
        operations: operationsFilter,
        clients,
      });
    },
    totalOperations(
      { organization, project, target, period, operations: operationsFilter, clients },
      _,
      { injector },
    ) {
      return injector.get(OperationsManager).countUniqueOperations({
        organization,
        project,
        target,
        period,
        operations: operationsFilter,
        clients,
      });
    },
    requestsOverTime(
      { organization, project, target, period, operations: operationsFilter, clients },
      { resolution },
      { injector },
    ) {
      return injector.get(OperationsManager).readRequestsOverTime({
        target,
        project,
        organization,
        period,
        resolution,
        operations: operationsFilter,
        clients,
      });
    },
    failuresOverTime(
      { organization, project, target, period, operations: operationsFilter, clients },
      { resolution },
      { injector },
    ) {
      return injector.get(OperationsManager).readFailuresOverTime({
        target,
        project,
        organization,
        period,
        resolution,
        operations: operationsFilter,
        clients,
      });
    },
    durationOverTime(
      { organization, project, target, period, operations: operationsFilter, clients },
      { resolution },
      { injector },
    ) {
      return injector.get(OperationsManager).readDurationOverTime({
        target,
        project,
        organization,
        period,
        resolution,
        operations: operationsFilter,
        clients,
      });
    },
    clients(
      { organization, project, target, period, operations: operationsFilter, clients },
      _,
      { injector },
    ) {
      return injector.get(OperationsManager).readUniqueClients({
        target,
        project,
        organization,
        period,
        operations: operationsFilter,
        clients,
      });
    },
    duration(
      { organization, project, target, period, operations: operationsFilter, clients },
      _,
      { injector },
    ) {
      return injector.get(OperationsManager).readGeneralDurationPercentiles({
        organization,
        project,
        target,
        period,
        operations: operationsFilter,
        clients,
      });
    },
  },
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
