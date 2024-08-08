import { z } from 'zod';
import { createTask } from '../utils';

export const sendSlackMessageTask = createTask(
  z.object({
    channel: z.string(),
    message: z.string(),
  }),
  async function slackTask(payload, helpers) {
    helpers.logger.info('Sending a slack message', {
      channel: payload.channel,
    });
  },
);
