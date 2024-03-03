import * as k8s from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import { DeploymentEnvironment } from '../types';
import { isProduction } from '../utils/helpers';
import { serviceLocalEndpoint } from '../utils/local-endpoint';
import { ServiceDeployment } from '../utils/service-deployment';
import { DbMigrations } from './db-migrations';
import { Docker } from './docker';
import { Kafka } from './kafka';
import { RateLimitService } from './rate-limit';
import { Tokens } from './tokens';

export type Usage = ReturnType<typeof deployUsage>;

export function deployUsage({
  deploymentEnv,
  tokens,
  kafka,
  dbMigrations,
  rateLimit,
  image,
  release,
  docker,
}: {
  image: string;
  release: string;
  deploymentEnv: DeploymentEnvironment;
  tokens: Tokens;
  kafka: Kafka;
  dbMigrations: DbMigrations;
  rateLimit: RateLimitService;
  docker: Docker;
}) {
  const commonConfig = new pulumi.Config('common');
  const commonEnv = commonConfig.requireObject<Record<string, string>>('env');
  const replicas = isProduction(deploymentEnv) ? 3 : 1;
  const cpuLimit = isProduction(deploymentEnv) ? '600m' : '300m';
  const maxReplicas = isProduction(deploymentEnv) ? 6 : 2;
  const kafkaBufferDynamic =
    kafka.config.bufferDynamic === 'true' || kafka.config.bufferDynamic === '1' ? '1' : '0';

  return new ServiceDeployment(
    'usage-service',
    {
      image,
      imagePullSecret: docker.secret,
      replicas,
      readinessProbe: '/_readiness',
      livenessProbe: '/_health',
      startupProbe: '/_health',
      availabilityOnEveryNode: true,
      env: {
        ...deploymentEnv,
        ...commonEnv,
        SENTRY: commonEnv.SENTRY_ENABLED,
        REQUEST_LOGGING: '0',
        KAFKA_BUFFER_SIZE: kafka.config.bufferSize,
        KAFKA_SASL_MECHANISM: kafka.config.saslMechanism,
        KAFKA_CONCURRENCY: kafka.config.concurrency,
        KAFKA_BUFFER_INTERVAL: kafka.config.bufferInterval,
        KAFKA_BUFFER_DYNAMIC: kafkaBufferDynamic,
        KAFKA_TOPIC: kafka.config.topic,
        RELEASE: release,
        TOKENS_ENDPOINT: serviceLocalEndpoint(tokens.service),
        RATE_LIMIT_ENDPOINT: serviceLocalEndpoint(rateLimit.service),
      },
      exposesMetrics: true,
      port: 4000,
      pdb: true,
      autoScaling: {
        cpu: {
          cpuAverageToScale: 60,
          limit: cpuLimit,
        },
        maxReplicas,
      },
    },
    [
      dbMigrations,
      tokens.deployment,
      tokens.service,
      rateLimit.deployment,
      rateLimit.service,
    ].filter(Boolean),
  )
    .withSecret('KAFKA_SASL_USERNAME', kafka.secret, 'saslUsername')
    .withSecret('KAFKA_SASL_PASSWORD', kafka.secret, 'saslPassword')
    .withSecret('KAFKA_SSL', kafka.secret, 'ssl')
    .withSecret('KAFKA_BROKER', kafka.secret, 'endpoint')
    .deploy();
}
