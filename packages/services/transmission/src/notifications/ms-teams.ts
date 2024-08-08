import { z } from 'zod';
import { createTask } from '../utils';

export const sendMSTeamWebhook = createTask(
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
