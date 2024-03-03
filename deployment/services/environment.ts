import { Config, Output } from '@pulumi/pulumi';
import { ServiceSecret } from '../secrets';

export class DataEncryptionSecret extends ServiceSecret<{
  encryptionPrivateKey: string | Output<string>;
}> {}

export function prepareEnvironment(input: {
  release: string;
  appDns: string;
  rootDns: string;
  environment: string;
}) {
  const commonConfig = new Config('common');

  const encryptionSecret = new DataEncryptionSecret('data-encryption', {
    encryptionPrivateKey: commonConfig.requireSecret('encryptionSecret'),
  });

  const env =
    input.environment === 'production' || input.environment === 'prod'
      ? 'production'
      : input.environment;

  return {
    env: {
      NODE_ENV: 'production',
      LOG_LEVEL: 'debug',
      DEPLOYED_DNS: input.appDns,
      ENVIRONMENT: input.environment,
      RELEASE: input.release,
    },
    isProduction: env === 'production',
    isStaging: env === 'staging',
    isDev: env === 'dev',
    encryptionSecret,
    release: input.release,
    appDns: input.appDns,
    rootDns: input.rootDns,
  };
}

export type Environment = ReturnType<typeof prepareEnvironment>;
