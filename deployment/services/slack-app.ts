import { Config, Output } from '@pulumi/pulumi';
import { ServiceSecret } from '../secrets';

class SlackIntegrationSecret extends ServiceSecret<{
  clientId: string | Output<string>;
  clientSecret: string | Output<string>;
}> {}

export function configureSlackApp() {
  const slackConfig = new Config('slack');

  const secret = new SlackIntegrationSecret('slack-app', {
    clientId: slackConfig.require('clientId'),
    clientSecret: slackConfig.requireSecret('clientSecret'),
  });

  return {
    secret,
  };
}

export type SlackApp = ReturnType<typeof configureSlackApp>;
