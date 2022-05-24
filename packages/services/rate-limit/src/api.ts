import * as trpc from '@trpc/server';
import type { Limiter } from './limiter';
import { z } from 'zod';
import { inferProcedureInput, inferProcedureOutput } from '@trpc/server';

export type RateLimitInput = z.infer<typeof VALIDATION>;

const VALIDATION = z
  .object({
    id: z.string().nonempty(),
    entityType: z.enum(['organization', 'target']),
    type: z.enum(['schema-push', 'operations-reporting']),
    /**
     * Token is optional, and used only when an additional blocking (WAF) process is needed.
     */
    token: z.string().nullish(),
  })
  .required();

export const rateLimitApiRouter = trpc
  .router<Limiter>()
  .query('getRetention', {
    input: z
      .object({
        targetId: z.string().nonempty(),
      })
      .required(),
    async resolve({ ctx, input }) {
      return ctx.getRetention(input.targetId);
    },
  })
  .query('checkRateLimit', {
    input: VALIDATION,
    async resolve({ ctx, input }) {
      return ctx.checkLimit(input);
    },
  });

export type RateLimitApi = typeof rateLimitApiRouter;
export type RateLimitApiQuery = keyof RateLimitApi['_def']['queries'];
export type RateLimitQueryOutput<TRouteKey extends RateLimitApiQuery> = inferProcedureOutput<
  RateLimitApi['_def']['queries'][TRouteKey]
>;
export type RateLimitQueryInput<TRouteKey extends RateLimitApiQuery> = inferProcedureInput<
  RateLimitApi['_def']['queries'][TRouteKey]
>;
