import { hash } from '../../../shared/helpers';
import { OperationsManager } from '../providers/operations-manager';
import type { SchemaCoordinateStatsResolvers } from './../../../__generated__/types.next';

export const SchemaCoordinateStats: SchemaCoordinateStatsResolvers = {
  totalRequests: ({ organization, project, target, period, schemaCoordinate }, _, { injector }) => {
    return injector.get(OperationsManager).countRequestsWithSchemaCoordinate({
      organization,
      project,
      target,
      period,
      schemaCoordinate,
    });
  },
  requestsOverTime: (
    { organization, project, target, period, schemaCoordinate },
    { resolution },
    { injector },
  ) => {
    return injector.get(OperationsManager).readRequestsOverTime({
      target,
      project,
      organization,
      period,
      resolution,
      schemaCoordinate,
    });
  },
  operations: async (
    { organization, project, target, period, schemaCoordinate },
    args,
    { injector },
  ) => {
    const operationsManager = injector.get(OperationsManager);
    const [operations, durations] = await Promise.all([
      operationsManager.readOperationsStats({
        organization,
        project,
        target,
        period,
        schemaCoordinate,
      }),
      operationsManager.readDetailedDurationPercentiles({
        organization,
        project,
        target,
        period,
        schemaCoordinate,
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
  clients: ({ organization, project, target, period, schemaCoordinate }, _, { injector }) => {
    return injector.get(OperationsManager).readUniqueClients({
      target,
      project,
      organization,
      period,
      schemaCoordinate,
    });
  },
};
