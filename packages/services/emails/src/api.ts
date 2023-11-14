import { z } from 'zod';
import { handleTRPCError } from '@hive/service-common';
import type { inferRouterInputs } from '@trpc/server';
import { initTRPC } from '@trpc/server';
import type { Context } from './context';
import { EmailInputShape } from './shapes';
import { renderEmailVerificationEmail } from './templates/email-verification';
import { renderPasswordResetEmail } from './templates/password-reset';

const t = initTRPC.context<Context>().create();
const procedure = t.procedure.use(handleTRPCError);

export const emailsApiRouter = t.router({
  schedule: procedure.input(EmailInputShape).mutation(async ({ ctx, input }) => {
    try {
      const job = await ctx.schedule(input);

      return { job: job.id ?? 'unknown' };
    } catch (error) {
      ctx.errorHandler('Failed to schedule an email', error as Error);
      throw error;
    }
  }),
  sendEmailVerificationEmail: procedure
    .input(
      z.object({
        user: z.object({
          email: z.string(),
          id: z.string(),
        }),
        emailVerifyLink: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
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
        ctx.errorHandler('Failed to schedule an email', error as Error);
        throw error;
      }
    }),
  sendPasswordResetEmail: procedure
    .input(
      z.object({
        user: z.object({
          email: z.string(),
          id: z.string(),
        }),
        passwordResetLink: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
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
        ctx.errorHandler('Failed to schedule an email', error as Error);
        throw error;
      }
    }),
});

export type EmailsApi = typeof emailsApiRouter;
export type EmailsApiInput = inferRouterInputs<EmailsApi>;
