import { z } from 'zod';
import { createTask } from '../../lib/utils.js';

export const sendMSTeamsWebhook = createTask(
  z.object({
    url: z.string().url(),
    body: z.string(),
  }),
  async function msTeamsTask(payload, helpers) {
    helpers.logger.info('Sending an MS Teams webhook', {
      url: payload.url,
    });
  },
);
