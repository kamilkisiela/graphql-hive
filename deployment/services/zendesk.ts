import { Config, Output } from '@pulumi/pulumi';
import { ServiceSecret } from '../secrets';
import { DeploymentEnvironment } from '../types';
import { isProduction } from '../utils/helpers';

export class ZendeskSecret extends ServiceSecret<{
  subdomain: string | Output<string>;
  username: string | Output<string>;
  password: string | Output<string>;
}> {}

export function configureZendesk(input: { deploymentEnv: DeploymentEnvironment }) {
  if (!isProduction(input.deploymentEnv)) {
    return {
      enabled: false,
      secret: null,
    };
  }

  const zendeskConfig = new Config('zendesk');

  const secret = new ZendeskSecret('zendesk', {
    subdomain: zendeskConfig.require('subdomain'),
    username: zendeskConfig.require('username'),
    password: zendeskConfig.requireSecret('password'),
  });

  return {
    enabled: true,
    secret,
  };
}

export type Zendesk = ReturnType<typeof configureZendesk>;
