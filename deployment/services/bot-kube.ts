import * as pulumi from '@pulumi/pulumi';
import { BotKube } from '../utils/botkube';

const botkubeConfig = new pulumi.Config('botkube');

export function deployBotKube({ envName }: { envName: string }) {
  if (!botkubeConfig.getBoolean('enabled')) {
    return;
  }

  if (botkubeConfig && botkubeConfig.get('slackChannel') && botkubeConfig.getSecret('slackToken')) {
    new BotKube().deploy({
      clusterName: envName,
      enableKubectl: true,
      slackChannelName: botkubeConfig.require('slackChannel'),
      slackToken: botkubeConfig.requireSecret('slackToken'),
    });
  }
}
