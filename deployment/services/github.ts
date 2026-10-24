import { Config, Output } from '@pulumi/pulumi';
import { ServiceSecret } from '../utils/secrets';

class GitHubIntegrationSecret extends ServiceSecret<{
  appId: string | Output<string>;
  privateKey: string | Output<string>;
  clientId: string | Output<string>;
  clientSecret: string | Output<string>;
}> {}

export function configureGithubApp() {
  const githubAppConfig = new Config('ghapp');
  const githubSecret = new GitHubIntegrationSecret('gitub-app', {
    appId: githubAppConfig.require('id'),
    privateKey: githubAppConfig.requireSecret('key'),
    clientId: githubAppConfig.require('clientId'),
    clientSecret: githubAppConfig.requireSecret('clientSecret'),
  });

  return {
    name: githubAppConfig.require('name'),
    secret: githubSecret,
  };
}

export type GitHubApp = ReturnType<typeof configureGithubApp>;
