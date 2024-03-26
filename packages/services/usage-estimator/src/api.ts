import { z } from 'zod';
import { handleTRPCError } from '@hive/service-common';
import type { FastifyRequest } from '@hive/service-common';
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';
import { initTRPC } from '@trpc/server';
import type { Estimator } from './estimator';

export function createContext(estimator: Estimator, req: FastifyRequest) {
  return {
    estimator,
    req,
  };
}

const t = initTRPC.context<ReturnType<typeof createContext>>().create();
const procedure = t.procedure.use(handleTRPCError);
const YYYYMMDD = new RegExp(/^(19\d\d|20\d\d)(0[1-9]|1[0-2])(0[1-9]|[12][0-9]|3[01])$/);

export const usageEstimatorApiRouter = t.router({
  estimateOperationsForOrganization: procedure
    .input(
      z
        .object({
          start: z.string().regex(YYYYMMDD),
          end: z.string().regex(YYYYMMDD),
          organizationId: z.string().min(1),
        })
        .required(),
    )
    .query(async ({ ctx, input }) => {
      const estimationResponse = await ctx.estimator.estimateCollectedOperationsForOrganization({
        organizationId: input.organizationId,
        start: input.start,
        end: input.end,
      });

      if (!estimationResponse.data.length) {
        return 0;
      }

      return parseInt(estimationResponse.data[0].total);
    }),
});

export type UsageEstimatorApi = typeof usageEstimatorApiRouter;

export type UsageEstimatorApiInput = inferRouterInputs<UsageEstimatorApi>;
export type UsageEstimatorApiOutput = inferRouterOutputs<UsageEstimatorApi>;
