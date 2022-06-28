import * as trpc from '@trpc/server';
import { inferProcedureInput } from '@trpc/server';
import { z } from 'zod';
import type { Context } from './types';

const webhookInput = z
  .object({
    endpoint: z.string().nonempty(),
    event: z
      .object({
        organization: z
          .object({
            id: z.string().nonempty(),
            cleanId: z.string().nonempty(),
            name: z.string().nonempty(),
          })
          .required(),
        project: z
          .object({
            id: z.string().nonempty(),
            cleanId: z.string().nonempty(),
            name: z.string().nonempty(),
          })
          .required(),
        target: z
          .object({
            id: z.string().nonempty(),
            cleanId: z.string().nonempty(),
            name: z.string().nonempty(),
          })
          .required(),
        schema: z
          .object({
            id: z.string().nonempty(),
            valid: z.boolean(),
            commit: z.string().nonempty(),
          })
          .required(),
        changes: z.array(z.any()),
        errors: z.array(z.any()),
      })
      .required(),
  })
  .required();

export const webhooksApiRouter = trpc.router<Context>().mutation('schedule', {
  input: webhookInput,
  async resolve({ ctx, input }) {
    try {
      const job = await ctx.schedule(input);

      return { job: job.id ?? 'unknown' };
    } catch (error) {
      ctx.errorHandler('Failed to schedule a webhook', error as Error, ctx.logger);
      throw error;
    }
  },
});

export type WebhooksApi = typeof webhooksApiRouter;
export type WebhooksApiMutate = keyof WebhooksApi['_def']['mutations'];

export type WebhooksMutationInput<TRouteKey extends WebhooksApiMutate> = inferProcedureInput<
  WebhooksApi['_def']['mutations'][TRouteKey]
>;

export type WebhookInput = WebhooksMutationInput<'schedule'>;
