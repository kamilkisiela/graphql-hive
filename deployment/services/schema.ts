import * as pulumi from '@pulumi/pulumi';
import { ServiceDeployment } from '../utils/service-deployment';
import type { Broker } from './cf-broker';
import { Docker } from './docker';
import { EgressPolicyManager } from './egress-policy';
import { Environment } from './environment';
import { Observability } from './observability';
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
  observability,
  egressManager,
}: {
  observability: Observability;
  image: string;
  environment: Environment;
  redis: Redis;
  broker: Broker;
  docker: Docker;
  sentry: Sentry;
  egressManager: EgressPolicyManager;
}) {
  // External composition (user-provided URLs) goes through the request broker when enabled.
  // Also controls the egress rules below.
  const requestBrokerEnabled = true;

  const minuteInMS = 60 * 1000;
  const hourInMS = minuteInMS * 60;

  const { deployment, service } = new ServiceDeployment(
    'schema-service',
    {
      image,
      imagePullSecret: docker.secret,
      availabilityOnEveryNode: true,
      env: {
        ...environment.envVars,
        SENTRY: sentry.enabled ? '1' : '0',
        REQUEST_BROKER: requestBrokerEnabled ? '1' : '0',
        SCHEMA_CACHE_POLL_INTERVAL_MS: '150',
        SCHEMA_CACHE_TTL_MS: '65000' /* 65s */,
        SCHEMA_CACHE_SUCCESS_TTL_MS: String(hourInMS * 2),
        COMPOSITION_WORKER_MAX_OLD_GENERATION_SIZE_MB: '716',
        COMPOSITION_WORKER_TRACK_MEMORY_USAGE: '1',
        OPENTELEMETRY_COLLECTOR_ENDPOINT:
          observability.enabled && observability.tracingEndpoint
            ? observability.tracingEndpoint
            : '',
        TRANSFORM_EXTERNAL_SUPERGRAPH_TO_PUBLIC_SDL: '1',
      },
      readinessProbe: '/_readiness',
      livenessProbe: '/_health',
      startupProbe: '/_health',
      exposesMetrics: true,
      replicas: environment.podsConfig.schemaService.replicas,
      memory: {
        limit: environment.podsConfig.schemaService.memoryLimit,
      },
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

  egressManager
    ?.allowInCluster(deployment, redis.deployment)
    .allowExternal(deployment, sentry.secret?.raw.dsn)
    .allowInCluster(deployment, observability.observability?.otlpCollectorService);

  if (requestBrokerEnabled) {
    egressManager?.allowExternal(deployment, broker.secret.raw.baseUrl);
  } else {
    // Calls user-provided URLs (external composition) directly
    egressManager?.allowAnyExternal(deployment);
  }

  return { deployment, service };
}
