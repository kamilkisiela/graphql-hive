import { z } from 'zod';
import { addJob } from '../../tasks';
import { publicProcedure } from '../../trpc';
import { renderEmailVerificationEmail } from './templates/email-verification';
import { renderPasswordResetEmail } from './templates/password-reset';

export const sendEmailVerificationEmail = publicProcedure
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
    const subject = 'Verify your email';
    const job = await addJob(
      ctx.runner,
      'sendEmail',
      {
        to: input.user.email,
        subject,
        body: renderEmailVerificationEmail({
          subject,
          verificationLink: input.emailVerifyLink,
          toEmail: input.user.email,
        }),
      },
      {
        maxAttempts: 5,
        jobKey: `email-verification-${input.user.id}-${new Date().getTime()}`,
        jobKeyMode: 'replace',
      },
    );

    return { job: job.id };
  });

export const sendPasswordResetEmail = publicProcedure
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
    const subject = 'Reset your password.';
    const job = await addJob(
      ctx.runner,
      'sendEmail',
      {
        to: input.user.email,
        subject,
        body: renderPasswordResetEmail({
          subject,
          passwordResetLink: input.passwordResetLink,
          toEmail: input.user.email,
        }),
      },
      {
        maxAttempts: 5,
        jobKey: `password-reset-${input.user.id}-${new Date().getTime()}`,
        jobKeyMode: 'replace',
      },
    );
    return { job: job.id };
  });
