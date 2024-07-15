import type { AlertsModule } from './__generated__/types';

export const resolvers: AlertsModule.Resolvers = {
  AlertSlackChannel: {
    __isTypeOf(channel) {
      return channel.type === 'SLACK';
    },
    channel(channel) {
      return channel.slackChannel!;
    },
  },
  AlertWebhookChannel: {
    __isTypeOf(channel) {
      return channel.type === 'WEBHOOK';
    },
    endpoint(channel) {
      return channel.webhookEndpoint!;
    },
  },
  TeamsWebhookChannel: {
    __isTypeOf(channel) {
      return channel.type === 'MSTEAMS_WEBHOOK';
    },
    endpoint(channel) {
      return channel.webhookEndpoint!;
    },
  },
};
