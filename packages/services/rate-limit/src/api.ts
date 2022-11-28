import { initTRPC } from '@trpc/server';
import type { Limiter } from './limiter';
import { z } from 'zod';
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';

const t = initTRPC.context<Limiter>().create();

export type RateLimitInput = z.infer<typeof VALIDATION>;

const VALIDATION = z
  .object({
    id: z.string().nonempty(),
    entityType: z.enum(['organization', 'target']),
    type: z.enum(['operations-reporting']),
    /**
     * Token is optional, and used only when an additional blocking (WAF) process is needed.
     */
    token: z.string().nullish(),
  })
  .required();

export const rateLimitApiRouter = t.router({
  getRetention: t.procedure
    .input(
      z
        .object({
          targetId: z.string().nonempty(),
        })
        .required(),
    )
    .query(({ ctx, input }) => {
      return ctx.getRetention(input.targetId);
    }),
  checkRateLimit: t.procedure.input(VALIDATION).query(({ ctx, input }) => {
    return ctx.checkLimit(input);
  }),
});

export type RateLimitApi = typeof rateLimitApiRouter;
export type RateLimitApiInput = inferRouterInputs<RateLimitApi>;
export type RateLimitApiOutput = inferRouterOutputs<RateLimitApi>;
