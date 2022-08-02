import * as trpc from '@trpc/server';
import { inferProcedureInput } from '@trpc/server';
import { z } from 'zod';
import type { Context } from './context';
import { renderTemplate, templateShapes } from './templates';

export const emailsApiRouter = trpc.router<Context>().mutation('schedule', {
  input: z
    .object({
      email: z.string().email().nonempty(),
      template: templateShapes,
    })
    .required(),
  async resolve({ ctx, input }) {
    try {
      const job = await ctx.schedule(renderTemplate(input.template));

      return { job: job.id ?? 'unknown' };
    } catch (error) {
      ctx.errorHandler('Failed to schedule an email', error as Error, ctx.logger);
      throw error;
    }
  },
});

export type EmailsApi = typeof emailsApiRouter;
export type EmailsApiMutate = keyof EmailsApi['_def']['mutations'];

export type EmailsMutationInput<TRouteKey extends EmailsApiMutate> = inferProcedureInput<
  EmailsApi['_def']['mutations'][TRouteKey]
>;

export type EmailScheduleInput = EmailsMutationInput<'schedule'>;
