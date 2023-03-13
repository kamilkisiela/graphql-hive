import * as pulumi from '@pulumi/pulumi';
import { BotKube } from '../utils/botkube';

const botkubeConfig = new pulumi.Config('botkube');

export function deployBotKube({ envName }: { envName: string }) {
  if (!botkubeConfig.getBoolean('enabled')) {
    return;
  }

  new BotKube().deploy({
    clusterName: envName,
    enableKubectl: true,
    slackChannelName: botkubeConfig.require('slackChannel'),
    slackAppToken: botkubeConfig.requireSecret('slackAppToken'),
    slackBotToken: botkubeConfig.requireSecret('slackBotToken'),
  });
}
