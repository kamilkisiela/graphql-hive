import * as pulumi from '@pulumi/pulumi';
import { Tokens } from './tokens';
import { DbMigrations } from './db-migrations';
import { ServiceDeployment } from '../utils/service-deployment';
import { serviceLocalEndpoint } from '../utils/local-endpoint';
import { DeploymentEnvironment } from '../types';
import { Kafka } from './kafka';
import { RateLimitService } from './rate-limit';
import { isProduction } from '../utils/helpers';
import * as k8s from '@pulumi/kubernetes';

const commonConfig = new pulumi.Config('common');
const commonEnv = commonConfig.requireObject<Record<string, string>>('env');

export type Usage = ReturnType<typeof deployUsage>;

export function deployUsage({
  deploymentEnv,
  tokens,
  kafka,
  dbMigrations,
  rateLimit,
  image,
  release,
  imagePullSecret,
}: {
  image: string;
  release: string;
  deploymentEnv: DeploymentEnvironment;
  tokens: Tokens;
  kafka: Kafka;
  dbMigrations: DbMigrations;
  rateLimit: RateLimitService;
  imagePullSecret: k8s.core.v1.Secret;
}) {
  const replicas = 1; /*isProduction(deploymentEnv) ? 2 : 1*/
  const cpuLimit = isProduction(deploymentEnv) ? '600m' : '300m';
  const maxReplicas = isProduction(deploymentEnv) ? 4 : 2;
  const kafkaBufferDynamic = kafka.config.bufferDynamic === 'true' ? '1' : '0';

  return new ServiceDeployment(
    'usage-service',
    {
      image,
      imagePullSecret,
      replicas,
      readinessProbe: '/_readiness',
      livenessProbe: '/_health',
      env: {
        ...deploymentEnv,
        ...commonEnv,
        SENTRY: commonEnv.SENTRY_ENABLED,
        KAFKA_SSL: '1',
        KAFKA_BROKER: kafka.config.endpoint,
        KAFKA_SASL_MECHANISM: 'plain',
        KAFKA_SASL_USERNAME: kafka.config.user,
        KAFKA_SASL_PASSWORD: kafka.config.key,
        KAFKA_BUFFER_SIZE: kafka.config.bufferSize,
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
        maxReplicas: maxReplicas,
      },
    },
    [dbMigrations, tokens.deployment, tokens.service, rateLimit.deployment, rateLimit.service],
  ).deploy();
}
