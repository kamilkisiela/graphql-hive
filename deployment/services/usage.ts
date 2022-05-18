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
  return new RemoteArtifactAsServiceDeployment(
    'usage-service',
    {
      storageContainer,
      replicas: 1,
      readinessProbe: '/_readiness',
      livenessProbe: '/_health',
      env: {
        ...deploymentEnv,
        ...commonEnv,
        KAFKA_CONNECTION_MODE: 'hosted',
        KAFKA_KEY: kafka.config.key,
        KAFKA_USER: kafka.config.user,
        KAFKA_BROKER: kafka.config.endpoint,
        KAFKA_BUFFER_SIZE: kafka.config.bufferSize,
        KAFKA_BUFFER_INTERVAL: kafka.config.bufferInterval,
        KAFKA_BUFFER_DYNAMIC: kafka.config.bufferDynamic,
        RELEASE: packageHelper.currentReleaseId(),
        TOKENS_ENDPOINT: serviceLocalEndpoint(tokens.service),
        RATE_LIMIT_ENDPOINT: serviceLocalEndpoint(rateLimit.service),
      },
      exposesMetrics: true,
      packageInfo: packageHelper.npmPack('@hive/usage'),
      port: 4000,
    },
    [
      dbMigrations,
      tokens.deployment,
      tokens.service,
      rateLimit.deployment,
      rateLimit.service,
    ]
  ).deploy();
}
