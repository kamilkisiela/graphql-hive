import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';
import { initTRPC } from '@trpc/server';
import type { Estimator } from './estimator';
import { z } from 'zod';

const DATE_RANGE_VALIDATION = {
  startTime: z.string().nonempty(),
  endTime: z.string().nonempty(),
};

const TARGET_BASED_FILTER = {
  targetIds: z.array(z.string().nonempty()),
};

const t = initTRPC.context<Estimator>().create();

export const usageEstimatorApiRouter = t.router({
  estimateOperationsForTarget: t.procedure
    .input(
      z
        .object({
          ...DATE_RANGE_VALIDATION,
          ...TARGET_BASED_FILTER,
        })
        .required(),
    )
    .query(async ({ ctx, input }) => {
      const estimationResponse = await ctx.estimateCollectedOperationsForTargets({
        targets: input.targetIds,
        startTime: new Date(input.startTime),
        endTime: new Date(input.endTime),
      });

      return {
        totalOperations: parseInt(estimationResponse.data[0].total),
      };
    }),
  estimateOperationsForAllTargets: t.procedure
    .input(z.object(DATE_RANGE_VALIDATION).required())
    .query(async ({ ctx, input }) => {
      const estimationResponse = await ctx.estimateOperationsForAllTargets({
        startTime: new Date(input.startTime),
        endTime: new Date(input.endTime),
      });

      return Object.fromEntries(
        estimationResponse.data.map(item => [item.target, parseInt(item.total)]),
      );
    }),
});

export type UsageEstimatorApi = typeof usageEstimatorApiRouter;

export type UsageEstimatorApiInput = inferRouterInputs<UsageEstimatorApi>;
export type UsageEstimatorApiOutput = inferRouterOutputs<UsageEstimatorApi>;
