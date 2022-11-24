import * as pulumi from '@pulumi/pulumi';
import * as azure from '@pulumi/azure';
import { RemoteArtifactAsServiceDeployment } from '../utils/remote-artifact-as-service';
import { DeploymentEnvironment } from '../types';
import { Redis } from './redis';
import { PackageHelper } from '../utils/pack';
import type { Broker } from './cf-broker';

const commonConfig = new pulumi.Config('common');
const commonEnv = commonConfig.requireObject<Record<string, string>>('env');

export type Schema = ReturnType<typeof deploySchema>;

export function deploySchema({
  deploymentEnv,
  redis,
  packageHelper,
  storageContainer,
  broker,
}: {
  storageContainer: azure.storage.Container;
  packageHelper: PackageHelper;
  deploymentEnv: DeploymentEnvironment;
  redis: Redis;
  broker: Broker;
}) {
  return new RemoteArtifactAsServiceDeployment(
    'schema-service',
    {
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
        REQUEST_BROKER: '1',
        REQUEST_BROKER_ENDPOINT: broker.workerBaseUrl,
        REQUEST_BROKER_SIGNATURE: broker.secretSignature,
      },
      readinessProbe: '/_readiness',
      livenessProbe: '/_health',
      exposesMetrics: true,
      packageInfo: packageHelper.npmPack('@hive/schema'),
      replicas: 2,
      pdb: true,
    },
    [redis.deployment, redis.service],
  ).deploy();
}
