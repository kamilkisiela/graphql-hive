import * as pulumi from '@pulumi/pulumi';

export interface RegistryConfig {
  registry: string;
  registryToken: pulumi.Output<string>;
  registryScope: string;
}
