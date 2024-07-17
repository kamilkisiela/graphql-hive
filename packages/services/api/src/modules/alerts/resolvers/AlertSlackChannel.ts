import type { AlertSlackChannelResolvers } from './../../../__generated__/types.next';

export const AlertSlackChannel: AlertSlackChannelResolvers = {
  __isTypeOf: channel => {
    return channel.type === 'SLACK';
  },
  channel: channel => {
    return channel.slackChannel!;
  },
};
