import { parseDateRangeInput } from '../../../shared/helpers';
import { OperationsManager } from '../providers/operations-manager';
import type { TargetResolvers } from './../../../__generated__/types.next';

export const Target: Pick<
  TargetResolvers,
  'operation' | 'requestsOverTime' | 'totalRequests' | '__isTypeOf'
> = {
  totalRequests: (target, { period }, { injector }) => {
    return injector.get(OperationsManager).countRequests({
      target: target.id,
      project: target.projectId,
      organization: target.orgId,
      period: parseDateRangeInput(period),
    });
  },
  requestsOverTime: async (target, { resolution, period }, { injector }) => {
    const result = await injector.get(OperationsManager).readRequestsOverTimeOfTargets({
      project: target.projectId,
      organization: target.orgId,
      targets: [target.id],
      period: parseDateRangeInput(period),
      resolution,
    });

    return result[target.id] ?? [];
  },
  operation: (target, args, { injector }) => {
    return injector.get(OperationsManager).getOperation({
      hash: args.hash,
      organization: target.orgId,
      project: target.projectId,
      target: target.id,
    });
  },
};
