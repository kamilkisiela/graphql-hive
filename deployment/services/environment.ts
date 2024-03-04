import { Config, Output } from '@pulumi/pulumi';
import { ServiceSecret } from '../utils/secrets';

export class DataEncryptionSecret extends ServiceSecret<{
  encryptionPrivateKey: string | Output<string>;
}> {}

export function prepareEnvironment(input: {
  release: string;
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

  const appDns = `app.${input.rootDns}`;

  return {
    envVars: {
      NODE_ENV: 'production',
      LOG_LEVEL: 'debug',
      DEPLOYED_DNS: appDns,
      ENVIRONMENT: input.environment,
      RELEASE: input.release,
    },
    envName: env,
    isProduction: env === 'production',
    isStaging: env === 'staging',
    isDev: env === 'dev',
    encryptionSecret,
    release: input.release,
    appDns,
    rootDns: input.rootDns,
  };
}

export type Environment = ReturnType<typeof prepareEnvironment>;
