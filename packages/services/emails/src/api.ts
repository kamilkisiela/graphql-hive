import * as trpc from '@trpc/server';
import { inferProcedureInput } from '@trpc/server';
import type { Context } from './context';
import { EmailInputShape } from './shapes';
import { z } from 'zod';
import { renderPasswordResetEmail } from './templates/password-reset';
import { renderEmailVerificationEmail } from './templates/email-verification';

export const emailsApiRouter = trpc
  .router<Context>()
  .mutation('schedule', {
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
  })
  .mutation('sendEmailVerificationEmail', {
    input: z.object({
      user: z.object({
        email: z.string(),
        id: z.string(),
      }),
      emailVerifyLink: z.string(),
    }),
    async resolve({ ctx, input }) {
      try {
        const subject = 'Verify your email';
        const job = await ctx.schedule({
          id: `email-verification-${input.user.id}-${new Date().getTime()}`,
          email: input.user.email,
          subject,
          body: renderEmailVerificationEmail({
            subject,
            verificationLink: input.emailVerifyLink,
            toEmail: input.user.email,
          }),
        });

        return { job: job.id ?? 'unknown' };
      } catch (error) {
        ctx.errorHandler('Failed to schedule an email', error as Error, ctx.logger);
        throw error;
      }
    },
  })
  .mutation('sendPasswordResetEmail', {
    input: z.object({
      user: z.object({
        email: z.string(),
        id: z.string(),
      }),
      passwordResetLink: z.string(),
    }),
    async resolve({ ctx, input }) {
      try {
        const subject = 'Reset your password.';
        const job = await ctx.schedule({
          id: `password-reset-${input.user.id}-${new Date().getTime()}`,
          email: input.user.email,
          subject,
          body: renderPasswordResetEmail({
            subject,
            passwordResetLink: input.passwordResetLink,
            toEmail: input.user.email,
          }),
        });
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
