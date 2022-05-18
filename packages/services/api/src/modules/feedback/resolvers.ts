import type { FeedbackModule } from './__generated__/types';
import * as Sentry from '@sentry/node';
import { WebClient } from '@slack/web-api';
import { AuthManager } from '../auth/providers/auth-manager';
import { Tracking } from '../shared/providers/tracking';
import {
  FEEDBACK_SLACK_CHANNEL,
  FEEDBACK_SLACK_TOKEN,
} from './providers/tokens';

export const resolvers: FeedbackModule.Resolvers = {
  Mutation: {
    async sendFeedback(_, { feedback }, { injector }) {
      const auth = injector.get(AuthManager);
      const tracking = injector.get(Tracking);
      const user = await auth.getCurrentUser();
      const slack = new WebClient(injector.get(FEEDBACK_SLACK_TOKEN));

      await Promise.all([
        tracking.track({
          event: 'FEEDBACK',
          data: {
            feedback,
          },
        }),
        slack.chat.postMessage({
          channel: injector.get(FEEDBACK_SLACK_CHANNEL),
          mrkdwn: true,
          text: [`Got a feedback from \`${user.email}\``, `> ${feedback}`].join(
            '\n'
          ),
        }),
      ]).catch((error) => {
        console.log('Feedback.sendFeedback error', error);
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
    },
  },
};
