import * as trpc from '@trpc/server';
import { inferProcedureInput } from '@trpc/server';
import type { Context } from './context';
import { EmailInputShape } from './shapes';

export const emailsApiRouter = trpc.router<Context>().mutation('schedule', {
  input: EmailInputShape,
  async resolve({ ctx, input }) {
    try {
      const job = await ctx.schedule(input);

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
