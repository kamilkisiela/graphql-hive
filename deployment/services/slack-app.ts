import { Config, Output } from '@pulumi/pulumi';
import { ServiceSecret } from '../secrets';

class SlackIntegrationSecret extends ServiceSecret<{
  clientId: string | Output<string>;
  clientSecret: string | Output<string>;
}> {}

export function configureSlackApp() {
  const appConfig = new Config('app');
  const appEnv = appConfig.requireObject<Record<string, string>>('env');

  const secret = new SlackIntegrationSecret('slack-app', {
    clientId: appEnv.SLACK_CLIENT_ID,
    clientSecret: appEnv.SLACK_CLIENT_SECRET,
  });

  return {
    secret,
  };
}

export type SlackApp = ReturnType<typeof configureSlackApp>;
