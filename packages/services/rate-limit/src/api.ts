import { z } from 'zod';
import { handleTRPCError } from '@hive/service-common';
import type { FastifyRequest } from '@hive/service-common';
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';
import { initTRPC } from '@trpc/server';
import { buildRateLimitWindow, type Limiter } from './limiter';

export interface Context {
  req: FastifyRequest;
  limiter: Limiter;
}

const t = initTRPC.context<Context>().create();
const procedure = t.procedure.use(handleTRPCError);

export const rateLimitApiRouter = t.router({
  getRetention: procedure
    .input(
      z
        .object({
          targetId: z.string().nonempty(),
        })
        .required(),
    )
    .query(({ ctx, input }) => {
      const organizationId = ctx.limiter.targetIdToOrgId(input.targetId);

      if (!organizationId) {
        throw new Error(`No organization found for targetId: ${input.targetId}`);
      }

      return ctx.limiter.getRetention(organizationId);
    }),
  calculateWindow: procedure
    .input(
      z
        .object({
          cycleDay: z.number().min(1),
        })
        .required(),
    )
    .query(({ input }) => {
      const window = buildRateLimitWindow(input.cycleDay);

      return {
        start: window.start.getTime(),
        end: window.end.getTime(),
      };
    }),
  checkRateLimitForOrganization: procedure
    .input(
      z
        .object({
          organizationId: z.string().min(1),
        })
        .required(),
    )
    .query(({ ctx, input }) => {
      return ctx.limiter.checkLimit(input.organizationId);
    }),
  checkRateLimitForTarget: procedure
    .input(
      z
        .object({
          targetId: z.string().min(1),
        })
        .required(),
    )
    .query(async ({ ctx, input }) => {
      const organizationId = ctx.limiter.targetIdToOrgId(input.targetId);

      if (!organizationId) {
        throw new Error(`No organization found for targetId: ${input.targetId}`);
      }

      return ctx.limiter.checkLimit(organizationId);
    }),
  invalidateCache: procedure.mutation(async ({ ctx }) => {
    return await ctx.limiter.invalidateCache();
  }),
});

export type RateLimitApi = typeof rateLimitApiRouter;
export type RateLimitApiInput = inferRouterInputs<RateLimitApi>;
export type RateLimitApiOutput = inferRouterOutputs<RateLimitApi>;
