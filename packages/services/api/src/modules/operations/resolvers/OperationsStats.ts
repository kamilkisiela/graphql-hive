import { hash } from '../../../shared/helpers';
import { OperationsManager } from '../providers/operations-manager';
import type { OperationsStatsResolvers } from './../../../__generated__/types.next';

export const OperationsStats: OperationsStatsResolvers = {
  operations: async (
    { organization, project, target, period, operations: operationsFilter, clients },
    _,
    { injector },
  ) => {
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
  totalRequests: (
    { organization, project, target, period, operations, clients },
    _,
    { injector },
  ) => {
    return injector.get(OperationsManager).countRequestsAndFailures({
      organization,
      project,
      target,
      period,
      operations,
      clients,
    });
  },
  totalFailures: (
    { organization, project, target, period, operations: operationsFilter, clients },
    _,
    { injector },
  ) => {
    return injector.get(OperationsManager).countFailures({
      organization,
      project,
      target,
      period,
      operations: operationsFilter,
      clients,
    });
  },
  totalOperations: (
    { organization, project, target, period, operations: operationsFilter, clients },
    _,
    { injector },
  ) => {
    return injector.get(OperationsManager).countUniqueOperations({
      organization,
      project,
      target,
      period,
      operations: operationsFilter,
      clients,
    });
  },
  requestsOverTime: (
    { organization, project, target, period, operations: operationsFilter, clients },
    { resolution },
    { injector },
  ) => {
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
  failuresOverTime: (
    { organization, project, target, period, operations: operationsFilter, clients },
    { resolution },
    { injector },
  ) => {
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
  durationOverTime: (
    { organization, project, target, period, operations: operationsFilter, clients },
    { resolution },
    { injector },
  ) => {
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
  clients: (
    { organization, project, target, period, operations: operationsFilter, clients },
    _,
    { injector },
  ) => {
    return injector.get(OperationsManager).readUniqueClients({
      target,
      project,
      organization,
      period,
      operations: operationsFilter,
      clients,
    });
  },
  duration: (
    { organization, project, target, period, operations: operationsFilter, clients },
    _,
    { injector },
  ) => {
    return injector.get(OperationsManager).readGeneralDurationPercentiles({
      organization,
      project,
      target,
      period,
      operations: operationsFilter,
      clients,
    });
  },
};
