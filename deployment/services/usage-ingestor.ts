import * as pulumi from '@pulumi/pulumi';
import * as azure from '@pulumi/azure';
import { DbMigrations } from './db-migrations';
import { RemoteArtifactAsServiceDeployment } from '../utils/remote-artifact-as-service';
import { PackageHelper } from '../utils/pack';
import { DeploymentEnvironment } from '../types';
import { Clickhouse } from './clickhouse';
import { Kafka } from './kafka';

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
  const replicas = 1;

  const clickhouseEnv = {
    CLICKHOUSE_PROTOCOL: clickhouse.config.protocol,
    CLICKHOUSE_HOST: clickhouse.config.host,
    CLICKHOUSE_PORT: clickhouse.config.port,
    CLICKHOUSE_USERNAME: clickhouse.config.username,
    CLICKHOUSE_PASSWORD: clickhouse.config.password,
    ...(clickhouse.config.cloud
      ? {
          CLICKHOUSE_CLOUD_PROTOCOL: clickhouse.config.cloud.protocol,
          CLICKHOUSE_CLOUD_HOST: clickhouse.config.cloud.host,
          CLICKHOUSE_CLOUD_PORT: clickhouse.config.cloud.port,
          CLICKHOUSE_CLOUD_USERNAME: clickhouse.config.cloud.username,
          CLICKHOUSE_CLOUD_PASSWORD: clickhouse.config.cloud.password,
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
        ...clickhouseEnv,
        HEARTBEAT_ENDPOINT: heartbeat ?? '',
        KAFKA_CONNECTION_MODE: 'hosted',
        KAFKA_KEY: kafka.config.key,
        KAFKA_USER: kafka.config.user,
        KAFKA_BROKER: kafka.config.endpoint,
        KAFKA_CONCURRENCY: `1`,
        KAFKA_TOPIC: kafka.config.topic,
        KAFKA_CONSUMER_GROUP: kafka.config.consumerGroup,
        BATCHING_INTERVAL: '30s',
        BATCHING_SIZE_LIMIT: '200mb',
        RELEASE: packageHelper.currentReleaseId(),
      },
      exposesMetrics: true,
      packageInfo: packageHelper.npmPack('@hive/usage-ingestor'),
      port: 4000,
    },
    [clickhouse.deployment, clickhouse.service, dbMigrations]
  ).deploy();
}
