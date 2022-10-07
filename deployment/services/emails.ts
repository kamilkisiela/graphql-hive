import * as pulumi from '@pulumi/pulumi';
import * as azure from '@pulumi/azure';
import { DockerAsServiceDeployment } from '../utils/docker-as-service';
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
  const { deployment, service } = new DockerAsServiceDeployment(
    'emails-service',
    {
      image: 'ghcr.io/kamilkisiela/graphql-hive/emails',
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
        BULLMQ_COMMANDS_FROM_ROOT: 'true',
        EMAIL_FROM: email.from,
        EMAIL_PROVIDER: 'postmark',
        EMAIL_PROVIDER_POSTMARK_TOKEN: email.token,
        EMAIL_PROVIDER_POSTMARK_MESSAGE_STREAM: email.messageStream,
        HEARTBEAT_ENDPOINT: heartbeat ?? '',
      },
      readinessProbe: '/_readiness',
      livenessProbe: '/_health',
      exposesMetrics: true,
      replicas: 1,
    },
    [redis.deployment, redis.service]
  ).deploy();

  return { deployment, service, localEndpoint: serviceLocalEndpoint(service) };
}
