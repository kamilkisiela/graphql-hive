import * as pulumi from '@pulumi/pulumi';
import * as azure from '@pulumi/azure';
import { DockerAsServiceDeployment } from '../utils/docker-as-service';
import { isProduction } from '../utils/helpers';
import { DeploymentEnvironment } from '../types';
import { Redis } from './redis';
import { PackageHelper } from '../utils/pack';

const commonConfig = new pulumi.Config('common');
const commonEnv = commonConfig.requireObject<Record<string, string>>('env');

export type Schema = ReturnType<typeof deploySchema>;

export function deploySchema({
  deploymentEnv,
  redis,
  packageHelper,
  storageContainer,
}: {
  storageContainer: azure.storage.Container;
  packageHelper: PackageHelper;
  deploymentEnv: DeploymentEnvironment;
  redis: Redis;
}) {
  return new DockerAsServiceDeployment(
    'schema-service',
    {
      image: 'ghcr.io/kamilkisiela/graphql-hive/schema',
      release: packageHelper.currentReleaseId(),
      storageContainer,
      env: {
        ...deploymentEnv,
        ...commonEnv,
        SENTRY: commonEnv.SENTRY_ENABLED,
        RELEASE: packageHelper.currentReleaseId(),
        REDIS_HOST: redis.config.host,
        REDIS_PORT: String(redis.config.port),
        REDIS_PASSWORD: redis.config.password,
        ENCRYPTION_SECRET: commonConfig.requireSecret('encryptionSecret'),
      },
      readinessProbe: '/_readiness',
      livenessProbe: '/_health',
      exposesMetrics: true,
      replicas: isProduction(deploymentEnv) ? 2 : 1,
    },
    [redis.deployment, redis.service]
  ).deploy();
}
