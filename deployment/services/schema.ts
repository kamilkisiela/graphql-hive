import * as pulumi from '@pulumi/pulumi';
import { DeploymentEnvironment } from '../types';
import { isProduction } from '../utils/helpers';
import { ServiceDeployment } from '../utils/service-deployment';
import type { Broker } from './cf-broker';
import { Common } from './common';
import { Docker } from './docker';
import { Redis } from './redis';

export type Schema = ReturnType<typeof deploySchema>;

export function deploySchema({
  common,
  deploymentEnv,
  redis,
  broker,
  release,
  image,
  docker,
}: {
  common: Common;
  image: string;
  release: string;
  deploymentEnv: DeploymentEnvironment;
  redis: Redis;
  broker: Broker;
  docker: Docker;
}) {
  const commonConfig = new pulumi.Config('common');
  const commonEnv = commonConfig.requireObject<Record<string, string>>('env');
  return new ServiceDeployment(
    'schema-service',
    {
      image,
      imagePullSecret: docker.secret,
      availabilityOnEveryNode: true,
      env: {
        ...deploymentEnv,
        ...commonEnv,
        SENTRY: commonEnv.SENTRY_ENABLED,
        RELEASE: release,
        REQUEST_BROKER: '1',
        SCHEMA_CACHE_POLL_INTERVAL_MS: '150',
        SCHEMA_CACHE_TTL_MS: '65000' /* 65s */,
        SCHEMA_CACHE_SUCCESS_TTL_MS: '86400000' /* 24h */,
        SCHEMA_COMPOSITION_TIMEOUT_MS: '60000' /* 60s */,
      },
      readinessProbe: '/_readiness',
      livenessProbe: '/_health',
      startupProbe: '/_health',
      exposesMetrics: true,
      replicas: isProduction(deploymentEnv) ? 3 : 1,
      pdb: true,
    },
    [redis.deployment, redis.service],
  )
    .withSecret('REDIS_HOST', redis.secret, 'host')
    .withSecret('REDIS_PORT', redis.secret, 'port')
    .withSecret('REDIS_PASSWORD', redis.secret, 'password')
    .withSecret('REQUEST_BROKER_ENDPOINT', broker.secret, 'baseUrl')
    .withSecret('REQUEST_BROKER_SIGNATURE', broker.secret, 'secretSignature')
    .withSecret('ENCRYPTION_SECRET', common.encryptionSecret, 'encryptionPrivateKey')
    .deploy();
}
