import * as k8s from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import { DeploymentEnvironment } from '../types';
import { CloudflareBroker } from '../utils/cloudflare';
import { isProduction } from '../utils/helpers';
import { ServiceDeployment } from '../utils/service-deployment';
import type { Broker } from './cf-broker';
import { Docker } from './docker';
import { Redis } from './redis';
import { Sentry } from './sentry';

const commonConfig = new pulumi.Config('common');
const commonEnv = commonConfig.requireObject<Record<string, string>>('env');

export type Webhooks = ReturnType<typeof deployWebhooks>;

export function deployWebhooks({
  deploymentEnv,
  heartbeat,
  broker,
  image,
  release,
  docker,
  redis,
  sentry,
}: {
  image: string;
  release: string;
  deploymentEnv: DeploymentEnvironment;
  heartbeat?: string;
  docker: Docker;
  broker: Broker;
  redis: Redis;
  sentry: Sentry;
}) {
  return new ServiceDeployment(
    'webhooks-service',
    {
      imagePullSecret: docker.secret,
      env: {
        ...deploymentEnv,
        ...commonEnv,
        SENTRY: sentry.enabled ? '1' : '0',
        HEARTBEAT_ENDPOINT: heartbeat ?? '',
        RELEASE: release,
        REQUEST_BROKER: '1',
      },
      readinessProbe: '/_readiness',
      livenessProbe: '/_health',
      startupProbe: '/_health',
      exposesMetrics: true,
      replicas: isProduction(deploymentEnv) ? 3 : 1,
      image,
    },
    [redis.deployment, redis.service],
  )
    .withSecret('REDIS_HOST', redis.secret, 'host')
    .withSecret('REDIS_PORT', redis.secret, 'port')
    .withSecret('REDIS_PASSWORD', redis.secret, 'password')
    .withSecret('REQUEST_BROKER_ENDPOINT', broker.secret, 'baseUrl')
    .withSecret('REQUEST_BROKER_SIGNATURE', broker.secret, 'secretSignature')
    .withConditionalSecret(sentry.enabled, 'SENTRY_DSN', sentry.secret, 'dsn')
    .deploy();
}
