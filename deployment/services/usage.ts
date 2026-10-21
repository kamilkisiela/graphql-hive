import { serviceLocalEndpoint } from '../utils/local-endpoint';
import { ServiceDeployment } from '../utils/service-deployment';
import { CommerceService } from './commerce';
import { DbMigrations } from './db-migrations';
import { Docker } from './docker';
import { EgressPolicyManager } from './egress-policy';
import { Environment } from './environment';
import { Kafka } from './kafka';
import { Observability } from './observability';
import { Postgres } from './postgres';
import { Redis } from './redis';
import { Sentry } from './sentry';

export type Usage = ReturnType<typeof deployUsage>;

export function deployUsage({
  environment,
  postgres,
  redis,
  kafka,
  dbMigrations,
  commerce,
  image,
  docker,
  observability,
  sentry,
  egressManager,
}: {
  observability: Observability;
  image: string;
  environment: Environment;
  postgres: Postgres;
  redis: Redis;
  kafka: Kafka;
  dbMigrations: DbMigrations;
  commerce: CommerceService;
  docker: Docker;
  sentry: Sentry;
  egressManager: EgressPolicyManager;
}) {
  const kafkaBufferDynamic =
    kafka.config.bufferDynamic === 'true' || kafka.config.bufferDynamic === '1' ? '1' : '0';

  const { deployment, service } = new ServiceDeployment(
    'usage-service',
    {
      image,
      imagePullSecret: docker.secret,
      replicas: environment.podsConfig.usageService.replicas,
      readinessProbe: {
        initialDelaySeconds: 10,
        periodSeconds: 5,
        failureThreshold: 1,
        timeoutSeconds: 5,
        endpoint: '/_readiness',
      },
      livenessProbe: '/_health',
      startupProbe: '/_health',
      availabilityOnEveryNode: true,
      env: {
        ...environment.envVars,
        NODEJS_FLAGS: '--max-old-space-size-percentage=80',
        LOG_LEVEL: 'info',
        SENTRY: sentry.enabled ? '1' : '0',
        REQUEST_LOGGING: '0',
        KAFKA_BUFFER_SIZE: kafka.config.bufferSize,
        KAFKA_SASL_MECHANISM: kafka.config.saslMechanism,
        KAFKA_CONCURRENCY: kafka.config.concurrency,
        KAFKA_BUFFER_INTERVAL: kafka.config.bufferInterval,
        KAFKA_BUFFER_DYNAMIC: kafkaBufferDynamic,
        KAFKA_TOPIC: kafka.config.topic,
        COMMERCE_ENDPOINT: serviceLocalEndpoint(commerce.service),
        OPENTELEMETRY_COLLECTOR_ENDPOINT:
          observability.enabled &&
          observability.enabledForUsageService &&
          observability.tracingEndpoint
            ? observability.tracingEndpoint
            : '',
      },
      exposesMetrics: true,
      port: 4000,
      pdb: {
        minAvailable: environment.isProduction ? environment.podsConfig.usageService.replicas : 1,
      },
      cpu: {
        limit: environment.podsConfig.usageService.cpuMax,
        requests: environment.podsConfig.usageService.cpuMin,
      },
      memory: {
        limit: environment.podsConfig.usageService.memory.max,
        requests: environment.podsConfig.usageService.memory.min,
      },
    },
    [dbMigrations, commerce.deployment, commerce.service].filter(Boolean),
  )
    // Redis
    .withSecret('REDIS_HOST', redis.secret, 'host')
    .withSecret('REDIS_PORT', redis.secret, 'port')
    .withSecret('REDIS_PASSWORD', redis.secret, 'password')
    // PG
    .withSecret('POSTGRES_HOST', postgres.pgBouncerSecret, 'host')
    .withSecret('POSTGRES_PORT', postgres.pgBouncerSecret, 'port')
    .withSecret('POSTGRES_USER', postgres.pgBouncerSecret, 'user')
    .withSecret('POSTGRES_PASSWORD', postgres.pgBouncerSecret, 'password')
    .withSecret('POSTGRES_DB', postgres.pgBouncerSecret, 'database')
    .withSecret('POSTGRES_SSL', postgres.pgBouncerSecret, 'ssl')
    // Kafka
    .withSecret('KAFKA_SASL_USERNAME', kafka.secret, 'saslUsername')
    .withSecret('KAFKA_SASL_PASSWORD', kafka.secret, 'saslPassword')
    .withSecret('KAFKA_SSL', kafka.secret, 'ssl')
    .withSecret('KAFKA_BROKER', kafka.secret, 'endpoint')
    .withConditionalSecret(sentry.enabled, 'SENTRY_DSN', sentry.secret, 'dsn')
    .deploy();

  egressManager
    ?.allowExternal(
      deployment,
      postgres.pgBouncerSecret.raw.host,
      postgres.pgBouncerSecret.raw.port,
    )
    .allowExternal(deployment, kafka.secret.raw.endpoint)
    .allowInCluster(deployment, redis.deployment)
    .allowInCluster(deployment, commerce.deployment)
    .allowExternal(deployment, sentry.secret?.raw.dsn)
    .allowInCluster(
      deployment,
      observability.enabledForUsageService
        ? observability.observability?.otlpCollectorService
        : null,
    );

  return { deployment, service };
}
