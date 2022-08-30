import * as pulumi from '@pulumi/pulumi';
import * as azure from '@pulumi/azure';
import { RemoteArtifactAsServiceDeployment } from '../utils/remote-artifact-as-service';
import { DeploymentEnvironment } from '../types';
import { Redis } from './redis';
import { PackageHelper } from '../utils/pack';
import { serviceLocalEndpoint } from '../utils/local-endpoint';

const commonConfig = new pulumi.Config('common');
const commonEnv = commonConfig.requireObject<Record<string, string>>('env');

export type Emails = ReturnType<typeof deployEmails>;

export function deployEmails({
  storageContainer,
  packageHelper,
  deploymentEnv,
  redis,
  heartbeat,
  email,
}: {
  storageContainer: azure.storage.Container;
  packageHelper: PackageHelper;
  deploymentEnv: DeploymentEnvironment;
  redis: Redis;
  heartbeat?: string;
  email: {
    token: pulumi.Output<string>;
    from: string;
    messageStream: string;
  };
}) {
  const { deployment, service } = new RemoteArtifactAsServiceDeployment(
    'emails-service',
    {
      storageContainer,
      env: {
        ...deploymentEnv,
        ...commonEnv,
        HEARTBEAT_ENDPOINT: heartbeat ?? '',
        METRICS_ENABLED: 'true',
        RELEASE: packageHelper.currentReleaseId(),
        REDIS_HOST: redis.config.host,
        REDIS_PORT: String(redis.config.port),
        REDIS_PASSWORD: redis.config.password,
        BULLMQ_COMMANDS_FROM_ROOT: 'true',
        EMAIL_PROVIDER: 'postmark',
        EMAIL_FROM: email.from,
        POSTMARK_TOKEN: email.token,
        POSTMARK_MESSAGE_STREAM: email.messageStream,
      },
      readinessProbe: '/_readiness',
      livenessProbe: '/_health',
      exposesMetrics: true,
      packageInfo: packageHelper.npmPack('@hive/emails'),
      replicas: 1,
    },
    [redis.deployment, redis.service]
  ).deploy();

  return { deployment, service, localEndpoint: serviceLocalEndpoint(service) };
}
