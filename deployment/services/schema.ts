import * as pulumi from '@pulumi/pulumi';
import { ServiceDeployment } from '../utils/service-deployment';
import type { Broker } from './cf-broker';
import { Docker } from './docker';
import { Environment } from './environment';
import { Redis } from './redis';
import { Sentry } from './sentry';

export type Schema = ReturnType<typeof deploySchema>;

export function deploySchema({
  environment,
  redis,
  broker,
  image,
  docker,
  sentry,
}: {
  image: string;
  environment: Environment;
  redis: Redis;
  broker: Broker;
  docker: Docker;
  sentry: Sentry;
}) {
  return new ServiceDeployment(
    'schema-service',
    {
      image,
      imagePullSecret: docker.secret,
      availabilityOnEveryNode: true,
      env: {
        ...environment.env,
        SENTRY: sentry.enabled ? '1' : '0',
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
      replicas: environment.isProduction ? 3 : 1,
      pdb: true,
    },
    [redis.deployment, redis.service],
  )
    .withSecret('REDIS_HOST', redis.secret, 'host')
    .withSecret('REDIS_PORT', redis.secret, 'port')
    .withSecret('REDIS_PASSWORD', redis.secret, 'password')
    .withSecret('REQUEST_BROKER_ENDPOINT', broker.secret, 'baseUrl')
    .withSecret('REQUEST_BROKER_SIGNATURE', broker.secret, 'secretSignature')
    .withSecret('ENCRYPTION_SECRET', environment.encryptionSecret, 'encryptionPrivateKey')
    .withConditionalSecret(sentry.enabled, 'SENTRY_DSN', sentry.secret, 'dsn')
    .deploy();
}
