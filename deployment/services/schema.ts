import * as k8s from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import { DeploymentEnvironment } from '../types';
import { isProduction } from '../utils/helpers';
import { ServiceDeployment } from '../utils/service-deployment';
import type { Broker } from './cf-broker';
import { Redis } from './redis';

const commonConfig = new pulumi.Config('common');
const commonEnv = commonConfig.requireObject<Record<string, string>>('env');

export type Schema = ReturnType<typeof deploySchema>;

export function deploySchema({
  deploymentEnv,
  redis,
  broker,
  release,
  image,
  imagePullSecret,
}: {
  image: string;
  release: string;
  deploymentEnv: DeploymentEnvironment;
  redis: Redis;
  broker: Broker;
  imagePullSecret: k8s.core.v1.Secret;
}) {
  return new ServiceDeployment(
    'schema-service',
    {
      image,
      imagePullSecret,
      availabilityOnEveryNode: true,
      env: {
        ...deploymentEnv,
        ...commonEnv,
        SENTRY: commonEnv.SENTRY_ENABLED,
        RELEASE: release,
        REDIS_HOST: redis.config.host,
        REDIS_PORT: String(redis.config.port),
        REDIS_PASSWORD: redis.config.password,
        ENCRYPTION_SECRET: commonConfig.requireSecret('encryptionSecret'),
        REQUEST_BROKER: '1',
        REQUEST_BROKER_ENDPOINT: broker.workerBaseUrl,
        REQUEST_BROKER_SIGNATURE: broker.secretSignature,
        SCHEMA_CACHE_POLL_INTERVAL_MS: '150',
        SCHEMA_CACHE_TTL_MS: '65000' /* 65s */,
        SCHEMA_CACHE_SUCCESS_TTL_MS: '86400000' /* 24h */,
        SCHEMA_COMPOSITION_TIMEOUT_MS: '60000' /* 60s */,
      },
      readinessProbe: '/_readiness',
      livenessProbe: '/_health',
      exposesMetrics: true,
      replicas: isProduction(deploymentEnv) ? 3 : 1,
      pdb: true,
    },
    [redis.deployment, redis.service],
  ).deploy();
}
