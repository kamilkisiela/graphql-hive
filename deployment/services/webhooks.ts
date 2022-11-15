import * as pulumi from '@pulumi/pulumi';
import * as azure from '@pulumi/azure';
import { RemoteArtifactAsServiceDeployment } from '../utils/remote-artifact-as-service';
import { DeploymentEnvironment } from '../types';
import { Redis } from './redis';
import { PackageHelper } from '../utils/pack';
import type { Broker } from './cf-broker';

const commonConfig = new pulumi.Config('common');
const commonEnv = commonConfig.requireObject<Record<string, string>>('env');

export type Webhooks = ReturnType<typeof deployWebhooks>;

export function deployWebhooks({
  storageContainer,
  packageHelper,
  deploymentEnv,
  redis,
  heartbeat,
  broker,
}: {
  storageContainer: azure.storage.Container;
  packageHelper: PackageHelper;
  deploymentEnv: DeploymentEnvironment;
  redis: Redis;
  broker: Broker;
  heartbeat?: string;
}) {
  return new RemoteArtifactAsServiceDeployment(
    'webhooks-service',
    {
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
        REQUEST_BROKER: '1',
        REQUEST_BROKER_ENDPOINT: broker.workerBaseUrl,
        REQUEST_BROKER_SIGNATURE: broker.secretSignature,
      },
      readinessProbe: '/_readiness',
      livenessProbe: '/_health',
      exposesMetrics: true,
      packageInfo: packageHelper.npmPack('@hive/webhooks'),
      replicas: 1,
    },
    [redis.deployment, redis.service]
  ).deploy();
}
