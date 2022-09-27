import * as pulumi from '@pulumi/pulumi';
import * as azure from '@pulumi/azure';
import { Tokens } from './tokens';
import { DbMigrations } from './db-migrations';
import { RemoteArtifactAsServiceDeployment } from '../utils/remote-artifact-as-service';
import { PackageHelper } from '../utils/pack';
import { serviceLocalEndpoint } from '../utils/local-endpoint';
import { DeploymentEnvironment } from '../types';
import { Kafka } from './kafka';
import { RateLimitService } from './rate-limit';
import { isProduction } from '../utils/helpers';

const commonConfig = new pulumi.Config('common');
const commonEnv = commonConfig.requireObject<Record<string, string>>('env');

export type Usage = ReturnType<typeof deployUsage>;

export function deployUsage({
  storageContainer,
  packageHelper,
  deploymentEnv,
  tokens,
  kafka,
  dbMigrations,
  rateLimit,
}: {
  storageContainer: azure.storage.Container;
  packageHelper: PackageHelper;
  deploymentEnv: DeploymentEnvironment;
  tokens: Tokens;
  kafka: Kafka;
  dbMigrations: DbMigrations;
  rateLimit: RateLimitService;
}) {
  const replicas = 1; /*isProduction(deploymentEnv) ? 2 : 1*/
  const cpuLimit = isProduction(deploymentEnv) ? '600m' : '300m';
  const maxReplicas = isProduction(deploymentEnv) ? 4 : 2;
  const kafkaBufferDynamic = kafka.config.bufferDynamic === 'true' ? '1' : '0';

  return new RemoteArtifactAsServiceDeployment(
    'usage-service',
    {
      storageContainer,
      replicas,
      readinessProbe: '/_readiness',
      livenessProbe: '/_health',
      env: {
        ...deploymentEnv,
        ...commonEnv,
        SENTRY: commonEnv.SENTRY_ENABLED,
        KAFKA_CONNECTION_MODE: 'hosted',
        KAFKA_KEY: kafka.config.key,
        KAFKA_USER: kafka.config.user,
        KAFKA_BROKER: kafka.config.endpoint,
        KAFKA_BUFFER_SIZE: kafka.config.bufferSize,
        KAFKA_BUFFER_INTERVAL: kafka.config.bufferInterval,
        KAFKA_BUFFER_DYNAMIC: kafkaBufferDynamic,
        KAFKA_TOPIC: kafka.config.topic,
        RELEASE: packageHelper.currentReleaseId(),
        TOKENS_ENDPOINT: serviceLocalEndpoint(tokens.service),
        RATE_LIMIT_ENDPOINT: serviceLocalEndpoint(rateLimit.service),
      },
      exposesMetrics: true,
      packageInfo: packageHelper.npmPack('@hive/usage'),
      port: 4000,
      autoScaling: {
        cpu: {
          cpuAverageToScale: 60,
          limit: cpuLimit,
        },
        maxReplicas: maxReplicas,
      },
    },
    [dbMigrations, tokens.deployment, tokens.service, rateLimit.deployment, rateLimit.service]
  ).deploy();
}
