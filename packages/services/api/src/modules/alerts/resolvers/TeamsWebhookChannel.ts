import type { TeamsWebhookChannelResolvers } from './../../../__generated__/types.next';

export const TeamsWebhookChannel: TeamsWebhookChannelResolvers = {
  __isTypeOf: channel => {
    return channel.type === 'MSTEAMS_WEBHOOK';
  },
  endpoint: async channel => {
    return channel.webhookEndpoint!;
  },
};
