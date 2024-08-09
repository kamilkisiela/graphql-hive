import { got } from 'got';
import { z } from 'zod';
import { env } from '../../environment.js';
import { createTask } from '../../lib/utils.js';

export const sendWebhookTask = createTask(
  z.object({
    url: z.string().url(),
    body: z.string(),
  }),
  async function webhookTask(payload, helpers) {
    helpers.logger.info('Sending a webhook', {
      url: payload.url,
    });
    if (env.requestBroker) {
      await got.post(env.requestBroker.endpoint, {
        headers: {
          Accept: 'text/plain',
          'x-hive-signature': env.requestBroker.signature,
        },
        timeout: {
          request: 10_000,
        },
        json: {
          url: payload.url,
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Accept-Encoding': 'gzip, deflate, br',
            'Content-Type': 'application/json',
          },
          body: payload.body,
          resolveResponseBody: false,
        },
      });
    } else {
      await got.post(payload.url, {
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate, br',
          'Content-Type': 'application/json',
        },
        timeout: {
          request: 10_000,
        },
        json: payload.body,
      });
    }

    helpers.logger.info('Webhook sent');
  },
);
