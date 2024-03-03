import { Config, Output } from '@pulumi/pulumi';
import { ServiceSecret } from '../secrets';
import { Environment } from './environment';

export class ZendeskSecret extends ServiceSecret<{
  subdomain: string | Output<string>;
  username: string | Output<string>;
  password: string | Output<string>;
}> {}

export function configureZendesk(input: { environment: Environment }) {
  if (!input.environment.isProduction) {
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
