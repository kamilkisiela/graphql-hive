import * as pulumi from '@pulumi/pulumi';
import * as azure from '@pulumi/azure';
import { RemoteArtifactAsServiceDeployment } from '../utils/remote-artifact-as-service';
import { Clickhouse } from './clickhouse';
import { Kafka } from './kafka';
import { PackageHelper } from '../utils/pack';
import { DeploymentEnvironment } from '../types';
const apiConfig = new pulumi.Config('api');

export type DbMigrations = ReturnType<typeof deployDbMigrations>;

export function deployDbMigrations({
  storageContainer,
  packageHelper,
  deploymentEnv,
  clickhouse,
  kafka,
}: {
  storageContainer: azure.storage.Container;
  packageHelper: PackageHelper;
  deploymentEnv: DeploymentEnvironment;
  clickhouse: Clickhouse;
  kafka: Kafka;
}) {
  const { job } = new RemoteArtifactAsServiceDeployment(
    'db-migrations',
    {
      env: {
        POSTGRES_CONNECTION_STRING: apiConfig.requireSecret(
          'postgresConnectionString'
        ),
        MIGRATOR: 'up',
        CLICKHOUSE_MIGRATOR: 'up',
        CLICKHOUSE_HOST: clickhouse.config.host,
        CLICKHOUSE_PORT: clickhouse.config.port,
        CLICKHOUSE_USERNAME: clickhouse.config.username,
        CLICKHOUSE_PASSWORD: clickhouse.config.password,
        CLICKHOUSE_PROTOCOL: clickhouse.config.protocol,
        KAFKA_BROKER: kafka.config.endpoint,
        ...deploymentEnv,
      },
      storageContainer,
      packageInfo: packageHelper.npmPack('@hive/storage'),
    },
    [clickhouse.deployment, clickhouse.service],
    clickhouse.service
  ).deployAsJob();

  return job;
}
