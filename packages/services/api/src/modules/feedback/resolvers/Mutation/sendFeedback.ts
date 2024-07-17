import * as Sentry from '@sentry/node';
import { WebClient } from '@slack/web-api';
import { AuthManager } from '../../../auth/providers/auth-manager';
import { FEEDBACK_SLACK_CHANNEL, FEEDBACK_SLACK_TOKEN } from '../../providers/tokens';
import type { MutationResolvers } from './../../../../__generated__/types.next';

export const sendFeedback: NonNullable<MutationResolvers['sendFeedback']> = async (
  _,
  { feedback },
  { injector },
) => {
  const auth = injector.get(AuthManager);
  const user = await auth.getCurrentUser();
  const slack = new WebClient(injector.get(FEEDBACK_SLACK_TOKEN));

  await slack.chat
    .postMessage({
      channel: injector.get(FEEDBACK_SLACK_CHANNEL),
      mrkdwn: true,
      text: [`Got a feedback from \`${user.email}\``, `> ${feedback}`].join('\n'),
    })
    .catch(error => {
      Sentry.captureException(error, {
        extra: {
          feedback,
        },
        user: {
          email: user.email,
        },
      });
    });

  return true;
};
