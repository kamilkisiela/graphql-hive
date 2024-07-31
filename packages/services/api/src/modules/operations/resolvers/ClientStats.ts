import { hash } from '../../../shared/helpers';
import { OperationsManager } from '../providers/operations-manager';
import type { ClientStatsResolvers } from './../../../__generated__/types.next';

export const ClientStats: ClientStatsResolvers = {
  totalRequests: ({ organization, project, target, period, clientName }, _, { injector }) => {
    return injector.get(OperationsManager).countRequestsAndFailures({
      organization,
      project,
      target,
      period,
      clients: clientName === 'unknown' ? ['unknown', ''] : [clientName],
    });
  },
  totalVersions: ({ organization, project, target, period, clientName }, _, { injector }) => {
    return injector.get(OperationsManager).countClientVersions({
      organization,
      project,
      target,
      period,
      clientName,
    });
  },
  requestsOverTime: (
    { organization, project, target, period, clientName },
    { resolution },
    { injector },
  ) => {
    return injector.get(OperationsManager).readRequestsOverTime({
      target,
      project,
      organization,
      period,
      resolution,
      clients: clientName === 'unknown' ? ['unknown', ''] : [clientName],
    });
  },
  operations: async ({ organization, project, target, period, clientName }, args, { injector }) => {
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
  versions: ({ organization, project, target, period, clientName }, { limit }, { injector }) => {
    return injector.get(OperationsManager).readClientVersions({
      target,
      project,
      organization,
      period,
      clientName,
      limit,
    });
  },
};
