import { z } from 'zod';
import { defineTask, implementTask } from '../kit.js';
import { renderPasswordResetEmail } from '../lib/emails/templates/password-reset.js';

/** How long a password reset link stays valid; the email states it and the server enforces it. */
export const PASSWORD_RESET_LINK_VALID_MINUTES = 15;

export const PasswordResetTask = defineTask({
  name: 'passwordReset',
  schema: z.object({
    user: z.object({
      email: z.string(),
      id: z.string(),
    }),
    passwordResetLink: z.string(),
  }),
});

export const task = implementTask(PasswordResetTask, async args => {
  await args.context.email.send({
    subject: `Reset your password`,
    to: args.input.user.email,
    body: renderPasswordResetEmail({
      passwordResetLink: args.input.passwordResetLink,
      toEmail: args.input.user.email,
      validForMinutes: PASSWORD_RESET_LINK_VALID_MINUTES,
    }),
  });
});
