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

const ORGANIZATION_SELECTOR = {
  organizationId: z.string().min(1),
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
  estimateOperationsForTarget: procedure
    .input(
      z
        .object({
          ...DATE_RANGE_VALIDATION,
          ...ORGANIZATION_SELECTOR,
        })
        .required(),
    )
    .query(async ({ ctx, input }) => {
      const estimationResponse = await ctx.estimator.estimateCollectedOperationsForOrganization({
        organizationId: input.organizationId,
        startTime: new Date(input.startTime),
        endTime: new Date(input.endTime),
      });

      return {
        totalOperations: parseInt(estimationResponse.data[0].total),
      };
    }),
  estimateOperationsForAllTargets: procedure
    .input(z.object(DATE_RANGE_VALIDATION).required())
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
