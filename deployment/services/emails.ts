import * as k8s from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import { DeploymentEnvironment } from '../types';
import { isProduction } from '../utils/helpers';
import { serviceLocalEndpoint } from '../utils/local-endpoint';
import { ServiceDeployment } from '../utils/service-deployment';
import { Redis } from './redis';

const commonConfig = new pulumi.Config('common');
const commonEnv = commonConfig.requireObject<Record<string, string>>('env');

export type Emails = ReturnType<typeof deployEmails>;

export function deployEmails({
  deploymentEnv,
  redis,
  heartbeat,
  email,
  release,
  image,
  imagePullSecret,
}: {
  release: string;
  image: string;
  deploymentEnv: DeploymentEnvironment;
  redis: Redis;
  heartbeat?: string;
  email: {
    token: pulumi.Output<string>;
    from: string;
    messageStream: string;
  };
  imagePullSecret: k8s.core.v1.Secret;
}) {
  const { deployment, service } = new ServiceDeployment(
    'emails-service',
    {
      imagePullSecret,
      env: {
        ...deploymentEnv,
        ...commonEnv,
        SENTRY: commonEnv.SENTRY_ENABLED,
        RELEASE: release,
        REDIS_HOST: redis.config.host,
        REDIS_PORT: String(redis.config.port),
        REDIS_PASSWORD: redis.config.password,
        EMAIL_FROM: email.from,
        EMAIL_PROVIDER: 'postmark',
        EMAIL_PROVIDER_POSTMARK_TOKEN: email.token,
        EMAIL_PROVIDER_POSTMARK_MESSAGE_STREAM: email.messageStream,
        HEARTBEAT_ENDPOINT: heartbeat ?? '',
      },
      readinessProbe: '/_readiness',
      livenessProbe: '/_health',
      exposesMetrics: true,
      image,
      replicas: isProduction(deploymentEnv) ? 2 : 1,
    },
    [redis.deployment, redis.service],
  ).deploy();

  return { deployment, service, localEndpoint: serviceLocalEndpoint(service) };
}
