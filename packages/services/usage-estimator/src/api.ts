import * as trpc from '@trpc/server';
import type { Estimator } from './estimator';
import { z } from 'zod';
import { inferProcedureInput, inferProcedureOutput } from '@trpc/server';

const DATE_RANGE_VALIDATION = {
  startTime: z.string().nonempty(),
  endTime: z.string().nonempty(),
};

const TARGET_BASED_FILTER = {
  targetIds: z.array(z.string().nonempty()),
};

export const usageEstimatorApiRouter = trpc
  .router<Estimator>()
  .query('estimateOperationsForTarget', {
    input: z
      .object({
        ...DATE_RANGE_VALIDATION,
        ...TARGET_BASED_FILTER,
      })
      .required(),
    async resolve({ ctx, input }) {
      const estimationResponse = await ctx.estimateCollectedOperationsForTargets({
        targets: input.targetIds,
        startTime: new Date(input.startTime),
        endTime: new Date(input.endTime),
      });

      return {
        totalOperations: parseInt(estimationResponse.data[0].total),
      };
    },
  })
  .query('estimateOperationsForAllTargets', {
    input: z.object(DATE_RANGE_VALIDATION).required(),
    async resolve({ ctx, input }) {
      const estimationResponse = await ctx.estimateOperationsForAllTargets({
        startTime: new Date(input.startTime),
        endTime: new Date(input.endTime),
      });

      return Object.fromEntries(
        estimationResponse.data.map(item => [item.target, parseInt(item.total)]),
      );
    },
  });

export type UsageEstimatorApi = typeof usageEstimatorApiRouter;
export type UsageEstimatorApiQuery = keyof UsageEstimatorApi['_def']['queries'];
export type UsageEstimatorQueryOutput<TRouteKey extends UsageEstimatorApiQuery> =
  inferProcedureOutput<UsageEstimatorApi['_def']['queries'][TRouteKey]>;
export type UsageEstimatorQueryInput<TRouteKey extends UsageEstimatorApiQuery> =
  inferProcedureInput<UsageEstimatorApi['_def']['queries'][TRouteKey]>;
