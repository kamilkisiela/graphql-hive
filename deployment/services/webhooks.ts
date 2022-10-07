import * as pulumi from '@pulumi/pulumi';
import * as azure from '@pulumi/azure';
import { DockerAsServiceDeployment } from '../utils/docker-as-service';
import { DeploymentEnvironment } from '../types';
import { Redis } from './redis';
import { PackageHelper } from '../utils/pack';

const commonConfig = new pulumi.Config('common');
const commonEnv = commonConfig.requireObject<Record<string, string>>('env');

export type Webhooks = ReturnType<typeof deployWebhooks>;

export function deployWebhooks({
  storageContainer,
  packageHelper,
  deploymentEnv,
  redis,
  heartbeat,
}: {
  storageContainer: azure.storage.Container;
  packageHelper: PackageHelper;
  deploymentEnv: DeploymentEnvironment;
  redis: Redis;
  heartbeat?: string;
}) {
  return new DockerAsServiceDeployment(
    'webhooks-service',
    {
      image: 'ghcr.io/kamilkisiela/graphql-hive/webhooks',
      release: packageHelper.currentReleaseId(),
      storageContainer,
      env: {
        ...deploymentEnv,
        ...commonEnv,
        SENTRY: commonEnv.SENTRY_ENABLED,
        HEARTBEAT_ENDPOINT: heartbeat ?? '',
        RELEASE: packageHelper.currentReleaseId(),
        REDIS_HOST: redis.config.host,
        REDIS_PORT: String(redis.config.port),
        REDIS_PASSWORD: redis.config.password,
        BULLMQ_COMMANDS_FROM_ROOT: 'true',
      },
      readinessProbe: '/_readiness',
      livenessProbe: '/_health',
      exposesMetrics: true,
      replicas: 1,
    },
    [redis.deployment, redis.service]
  ).deploy();
}
