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
  const apiDns = `api.${input.rootDns}`;
  const isProduction = env === 'production';
  const isStaging = env === 'staging';
  const isDev = env === 'dev';

  return {
    envVars: {
      NODE_ENV: 'production',
      LOG_LEVEL: 'debug',
      DEPLOYED_DNS: appDns,
      ENVIRONMENT: input.environment,
      RELEASE: input.release,
    },
    envName: env,
    isProduction,
    isStaging,
    isDev,
    encryptionSecret,
    release: input.release,
    appDns,
    apiDns,
    rootDns: input.rootDns,
    podsConfig: {
      general: {
        replicas: isProduction || isStaging ? 3 : 1,
      },
      graphqlApi: {
        replicas: isProduction ? 12 : isStaging ? 3 : 1,
      },
      envoy: {
        replicas: isProduction || isStaging ? 3 : 1,
        cpuLimit: isProduction ? '1500m' : isStaging ? '300m' : '120m',
        memoryLimit: isProduction || isStaging ? '2Gi' : '200Mi',
        timeouts: {
          idleTimeout: 905,
        },
      },
      schemaService: {
        memoryLimit: isProduction || isStaging ? '3584Mi' : '1Gi',
        replicas: isProduction ? 6 : isStaging ? 3 : 1,
      },
      usageService: {
        replicas: isProduction ? 18 : isStaging ? 3 : 1,
        cpuMin: isProduction || isStaging ? '200m' : '100m',
        cpuMax: isProduction || isStaging ? '1000m' : '100m',
        memory:
          isProduction || isStaging
            ? {
                min: '2000Mi',
                max: '2500Mi',
              }
            : {
                min: '200Mi',
                max: '500Mi',
              },
      },
      usageIngestorService: {
        replicas: isProduction || isStaging ? 6 : 1,
        cpuMax: isProduction || isStaging ? '1000m' : '100m',
        cpuMin: isProduction || isStaging ? '300m' : '100m',
        maxReplicas: isProduction || isStaging ? /* numberOfPartitions */ 16 : 2,
        cpuAverageToScale: 60,
      },
      redis: {
        memoryLimit: isProduction || isStaging ? '4Gi' : '100Mi',
        cpuMax: isProduction || isStaging ? '1000m' : '100m',
        cpuMin: isProduction || isStaging ? '100m' : '50m',
      },
      internalObservability: {
        cpuLimit: isProduction ? '512m' : '150m',
        memoryLimit: isProduction ? '1000Mi' : '300Mi',
      },
      tracingCollector: {
        cpuMax: isProduction || isStaging ? '1000m' : '300m',
        cpuMin: '100m',
        memoryLimit: isProduction || isStaging ? '1000Mi' : '512Mi',
        maxReplicas: isProduction || isStaging ? 3 : 1,
        replicas: 1,
      },
    },
  };
}

export type Environment = ReturnType<typeof prepareEnvironment>;
