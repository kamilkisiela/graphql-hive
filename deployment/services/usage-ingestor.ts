import * as pulumi from '@pulumi/pulumi';
import * as azure from '@pulumi/azure';
import { DbMigrations } from './db-migrations';
import { RemoteArtifactAsServiceDeployment } from '../utils/remote-artifact-as-service';
import { PackageHelper } from '../utils/pack';
import { DeploymentEnvironment } from '../types';
import { Clickhouse } from './clickhouse';
import { Kafka } from './kafka';
import { isProduction } from '../utils/helpers';

const commonConfig = new pulumi.Config('common');
const commonEnv = commonConfig.requireObject<Record<string, string>>('env');

export type UsageIngestor = ReturnType<typeof deployUsageIngestor>;

export function deployUsageIngestor({
  storageContainer,
  packageHelper,
  deploymentEnv,
  clickhouse,
  kafka,
  dbMigrations,
  heartbeat,
}: {
  storageContainer: azure.storage.Container;
  packageHelper: PackageHelper;
  deploymentEnv: DeploymentEnvironment;
  clickhouse: Clickhouse;
  kafka: Kafka;
  dbMigrations: DbMigrations;
  heartbeat?: string;
}) {
  const numberOfPartitions = 6;
  const replicas = isProduction(deploymentEnv) ? 4 : 1;
  const cpuLimit = isProduction(deploymentEnv) ? '600m' : '300m';
  const maxReplicas = isProduction(deploymentEnv) ? numberOfPartitions : 2;

  const clickhouseEnv = {
    CLICKHOUSE_PROTOCOL: clickhouse.config.protocol,
    CLICKHOUSE_HOST: clickhouse.config.host,
    CLICKHOUSE_PORT: clickhouse.config.port,
    CLICKHOUSE_USERNAME: clickhouse.config.username,
    CLICKHOUSE_PASSWORD: clickhouse.config.password,
    ...(clickhouse.config.cloud
      ? {
          CLICKHOUSE_MIRROR_PROTOCOL: clickhouse.config.cloud.protocol,
          CLICKHOUSE_MIRROR_HOST: clickhouse.config.cloud.host,
          CLICKHOUSE_MIRROR_PORT: clickhouse.config.cloud.port,
          CLICKHOUSE_MIRROR_USERNAME: clickhouse.config.cloud.username,
          CLICKHOUSE_MIRROR_PASSWORD: clickhouse.config.cloud.password,
        }
      : {}),
  };

  return new RemoteArtifactAsServiceDeployment(
    'usage-ingestor-service',
    {
      storageContainer,
      replicas,
      readinessProbe: '/_readiness',
      livenessProbe: '/_health',
      env: {
        ...deploymentEnv,
        ...commonEnv,
        SENTRY: commonEnv.SENTRY_ENABLED,
        ...clickhouseEnv,
        KAFKA_SSL: '1',
        KAFKA_BROKER: kafka.config.endpoint,
        KAFKA_SASL_MECHANISM: 'plain',
        KAFKA_SASL_USERNAME: kafka.config.user,
        KAFKA_SASL_PASSWORD: kafka.config.key,
        KAFKA_CONCURRENCY: '1',
        KAFKA_TOPIC: kafka.config.topic,
        KAFKA_CONSUMER_GROUP: kafka.config.consumerGroup,
        RELEASE: packageHelper.currentReleaseId(),
        HEARTBEAT_ENDPOINT: heartbeat ?? '',
      },
      exposesMetrics: true,
      packageInfo: packageHelper.npmPack('@hive/usage-ingestor'),
      port: 4000,
      autoScaling: {
        cpu: {
          cpuAverageToScale: 60,
          limit: cpuLimit,
        },
        maxReplicas: maxReplicas,
      },
    },
    [clickhouse.deployment, clickhouse.service, dbMigrations]
  ).deploy();
}
