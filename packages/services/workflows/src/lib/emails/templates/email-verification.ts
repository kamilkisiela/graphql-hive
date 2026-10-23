import { button, email, mjml, paragraph } from '../components.js';

export function renderEmailVerificationEmail(input: {
  verificationLink: string;
  toEmail: string;
  validForMinutes: number;
}) {
  return email({
    title: `Verify Your Email Address`,
    body: mjml`
      ${paragraph(`To complete your sign-up, please verify your email address by clicking the link below:`)}
      ${button({ url: input.verificationLink, text: 'Verify Email' })}
      ${paragraph(`This link is valid for ${input.validForMinutes} minutes.`)}
      ${paragraph(`If you didn't sign up, you can ignore this email.`)}
    `,
  });
}
