import * as pulumi from '@pulumi/pulumi';

export interface DeploymentEnvironment {
  ENVIRONMENT: string;
  NODE_ENV: string;
  DEPLOYED_DNS: string;
}

export interface RegistryConfig {
  registry: string;
  registryToken: pulumi.Output<string>;
  registryScope: string;
}
