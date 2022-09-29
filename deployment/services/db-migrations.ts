import * as pulumi from '@pulumi/pulumi';
import * as azure from '@pulumi/azure';
import { parse } from 'pg-connection-string';
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
  const rawConnectionString = apiConfig.requireSecret('postgresConnectionString');
  const connectionString = rawConnectionString.apply(rawConnectionString => parse(rawConnectionString));

  const { job } = new RemoteArtifactAsServiceDeployment(
    'db-migrations',
    {
      env: {
        POSTGRES_HOST: connectionString.apply(connection => connection.host ?? ''),
        POSTGRES_PORT: connectionString.apply(connection => connection.port ?? ''),
        POSTGRES_PASSWORD: connectionString.apply(connection => connection.password ?? ''),
        POSTGRES_USER: connectionString.apply(connection => connection.user ?? ''),
        POSTGRES_DB: connectionString.apply(connection => connection.database ?? ''),
        POSTGRES_ENABLE_SSL: connectionString.apply(connection => (connection.ssl ? '1' : '0')),
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
