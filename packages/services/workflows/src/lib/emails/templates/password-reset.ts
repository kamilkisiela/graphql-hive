import { button, email, mjml, paragraph } from '../components.js';

export function renderPasswordResetEmail(input: {
  passwordResetLink: string;
  toEmail: string;
  validForMinutes: number;
}) {
  return email({
    title: `Reset Your Password`,
    body: mjml`
      ${paragraph(`We received a request to reset your password. Click the link below to set a new password:`)}
      ${button({ url: input.passwordResetLink, text: 'Reset your password' })}
      ${paragraph(`This link is valid for ${input.validForMinutes} minutes.`)}
      ${paragraph(`If you didn't request a password reset, you can ignore this email.`)}
    `,
  });
}
