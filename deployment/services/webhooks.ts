import * as k8s from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import { DeploymentEnvironment } from '../types';
import { isProduction } from '../utils/helpers';
import { ServiceDeployment } from '../utils/service-deployment';
import type { Broker } from './cf-broker';
import { Redis } from './redis';

const commonConfig = new pulumi.Config('common');
const commonEnv = commonConfig.requireObject<Record<string, string>>('env');

export type Webhooks = ReturnType<typeof deployWebhooks>;

export function deployWebhooks({
  deploymentEnv,
  redis,
  heartbeat,
  broker,
  image,
  release,
  imagePullSecret,
}: {
  image: string;
  release: string;
  deploymentEnv: DeploymentEnvironment;
  redis: Redis;
  broker: Broker;
  heartbeat?: string;
  imagePullSecret: k8s.core.v1.Secret;
}) {
  return new ServiceDeployment(
    'webhooks-service',
    {
      imagePullSecret,
      env: {
        ...deploymentEnv,
        ...commonEnv,
        SENTRY: commonEnv.SENTRY_ENABLED,
        HEARTBEAT_ENDPOINT: heartbeat ?? '',
        RELEASE: release,
        REDIS_HOST: redis.config.host,
        REDIS_PORT: String(redis.config.port),
        REDIS_PASSWORD: redis.config.password,
        REQUEST_BROKER: '1',
        REQUEST_BROKER_ENDPOINT: broker.workerBaseUrl,
        REQUEST_BROKER_SIGNATURE: broker.secretSignature,
      },
      readinessProbe: '/_readiness',
      livenessProbe: '/_health',
      exposesMetrics: true,
      replicas: isProduction(deploymentEnv) ? 3 : 1,
      image,
    },
    [redis.deployment, redis.service],
  ).deploy();
}
