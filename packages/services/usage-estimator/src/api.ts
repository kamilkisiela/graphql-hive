import { z } from 'zod';
import { handleTRPCError } from '@hive/service-common';
import type { FastifyRequest } from '@hive/service-common';
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';
import { initTRPC } from '@trpc/server';
import type { Estimator } from './estimator';

const DATE_RANGE_VALIDATION = {
  startTime: z.string().min(1),
  endTime: z.string().min(1),
};

export function createContext(estimator: Estimator, req: FastifyRequest) {
  return {
    estimator,
    req,
  };
}

const t = initTRPC.context<ReturnType<typeof createContext>>().create();
const procedure = t.procedure.use(handleTRPCError);

export const usageEstimatorApiRouter = t.router({
  estimateOperationsForOrganization: procedure
    .input(
      z
        .object({
          month: z.number().min(1).max(12),
          year: z
            .number()
            .min(new Date().getFullYear() - 1)
            .max(new Date().getFullYear()),
          organizationId: z.string().min(1),
        })
        .required(),
    )
    .query(async ({ ctx, input }) => {
      const estimationResponse = await ctx.estimator.estimateCollectedOperationsForOrganization({
        organizationId: input.organizationId,
        month: input.month,
        year: input.year,
      });

      if (!estimationResponse.data.length) {
        return {
          totalOperations: 0,
        };
      }

      return {
        totalOperations: parseInt(estimationResponse.data[0].total),
      };
    }),
  estimateOperationsForAllTargets: procedure
    .input(
      z
        .object({
          startTime: z.string().min(1),
          endTime: z.string().min(1),
        })
        .required(),
    )
    .query(async ({ ctx, input }) => {
      const estimationResponse = await ctx.estimator.estimateOperationsForAllTargets({
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
