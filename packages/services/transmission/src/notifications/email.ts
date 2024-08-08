import mjml2html from 'mjml';
import { z } from 'zod';
import { captureException } from '@sentry/node';
import { createTask } from '../utils';
import { emailsTotal } from './email/metrics';
import { emailProvider } from './email/providers';

export const sendEmailTask = createTask(
  z.object({
    to: z.string().email(),
    subject: z.string(),
    body: z.string(),
  }),
  async function emailTask(payload, helpers) {
    helpers.logger.info('Sending an email', {
      to: payload.to,
      subject: payload.subject,
    });

    let body = payload.body;
    // Poor mans MJML check :)
    if (body.includes('<mjml>')) {
      const rendered = mjml2html(body, {
        minify: false,
        minifyOptions: undefined,
      });

      if (rendered.errors.length > 0) {
        const msg = rendered.errors.map(e => e.formattedMessage).join('\n');
        helpers.logger.error('MJML rendering failed', {
          error: msg,
        });
        captureException(new Error(msg), {
          extra: {
            jobId: helpers.job.id,
          },
        });
        helpers.logger.error('Email sending failed');
        return;
      }
      body = rendered.html;
    }

    await emailProvider.send({
      to: payload.to,
      subject: payload.subject,
      body,
    });

    emailsTotal.inc();
  },
);
