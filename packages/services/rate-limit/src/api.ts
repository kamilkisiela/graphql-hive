import { z } from 'zod';
import { handleTRPCError } from '@hive/service-common';
import type { FastifyRequest } from '@hive/service-common';
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';
import { initTRPC } from '@trpc/server';
import type { Limiter } from './limiter';

export interface Context {
  req: FastifyRequest;
  limiter: Limiter;
}

const t = initTRPC.context<Context>().create();
const procedure = t.procedure.use(handleTRPCError);

export type RateLimitInput = z.infer<typeof VALIDATION>;

const VALIDATION = z
  .object({
    id: z.string().min(1),
    entityType: z.enum(['organization', 'target']),
    type: z.enum(['operations-reporting']),
    /**
     * Token is optional, and used only when an additional blocking (WAF) process is needed.
     */
    token: z.string().nullish().optional(),
  })
  .required();

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
      return ctx.limiter.getRetention(input.targetId);
    }),
  checkRateLimit: procedure.input(VALIDATION).query(({ ctx, input }) => {
    return ctx.limiter.checkLimit(input);
  }),
});

export type RateLimitApi = typeof rateLimitApiRouter;
export type RateLimitApiInput = inferRouterInputs<RateLimitApi>;
export type RateLimitApiOutput = inferRouterOutputs<RateLimitApi>;
