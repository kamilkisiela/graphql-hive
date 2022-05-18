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
}: {
  storageContainer: azure.storage.Container;
  packageHelper: PackageHelper;
  deploymentEnv: DeploymentEnvironment;
  clickhouse: Clickhouse;
  kafka: Kafka;
  dbMigrations: DbMigrations;
}) {
  const numberOfPartitions = 4;
  const replicas = isProduction(deploymentEnv) ? 2 : 1;
  const partitionsConsumedConcurrently = Math.floor(
    numberOfPartitions / replicas
  );

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
        KAFKA_CONNECTION_MODE: 'hosted',
        KAFKA_KEY: kafka.config.key,
        KAFKA_USER: kafka.config.user,
        KAFKA_BROKER: kafka.config.endpoint,
        KAFKA_CONCURRENCY: `${partitionsConsumedConcurrently}`,
        CLICKHOUSE_PROTOCOL: clickhouse.config.protocol,
        CLICKHOUSE_HOST: clickhouse.config.host,
        CLICKHOUSE_PORT: clickhouse.config.port,
        CLICKHOUSE_USERNAME: clickhouse.config.username,
        CLICKHOUSE_PASSWORD: clickhouse.config.password,
        RELEASE: packageHelper.currentReleaseId(),
      },
      exposesMetrics: true,
      packageInfo: packageHelper.npmPack('@hive/usage-ingestor'),
      port: 4000,
    },
    [clickhouse.deployment, clickhouse.service, dbMigrations]
  ).deploy();
}
