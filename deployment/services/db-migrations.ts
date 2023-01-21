import * as k8s from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import { parse } from 'pg-connection-string';
import { DeploymentEnvironment } from '../types';
import { ServiceDeployment } from '../utils/service-deployment';
import { Clickhouse } from './clickhouse';
import { Kafka } from './kafka';
const apiConfig = new pulumi.Config('api');

export type DbMigrations = ReturnType<typeof deployDbMigrations>;

export function deployDbMigrations({
  deploymentEnv,
  clickhouse,
  kafka,
  image,
  imagePullSecret,
  dependencies,
  force,
}: {
  deploymentEnv: DeploymentEnvironment;
  clickhouse: Clickhouse;
  kafka: Kafka;
  image: string;
  imagePullSecret: k8s.core.v1.Secret;
  dependencies?: pulumi.Resource[];
  force?: boolean;
}) {
  const rawConnectionString = apiConfig.requireSecret('postgresConnectionString');
  const connectionString = rawConnectionString.apply(rawConnectionString =>
    parse(rawConnectionString),
  );

  const { job } = new ServiceDeployment(
    'db-migrations',
    {
      imagePullSecret,
      image,
      env: {
        POSTGRES_HOST: connectionString.apply(connection => connection.host ?? ''),
        POSTGRES_PORT: connectionString.apply(connection => connection.port ?? '5432'),
        POSTGRES_PASSWORD: connectionString.apply(connection => connection.password ?? ''),
        POSTGRES_USER: connectionString.apply(connection => connection.user ?? ''),
        POSTGRES_DB: connectionString.apply(connection => connection.database ?? ''),
        POSTGRES_SSL: connectionString.apply(connection => (connection.ssl ? '1' : '0')),
        MIGRATOR: 'up',
        CLICKHOUSE_MIGRATOR: 'up',
        CLICKHOUSE_HOST: clickhouse.config.host,
        CLICKHOUSE_PORT: clickhouse.config.port,
        CLICKHOUSE_USERNAME: clickhouse.config.username,
        CLICKHOUSE_PASSWORD: clickhouse.config.password,
        CLICKHOUSE_PROTOCOL: clickhouse.config.protocol,
        KAFKA_BROKER: kafka.config.endpoint,
        TS_NODE_TRANSPILE_ONLY: 'true',
        ...deploymentEnv,
        // Change to this env var will lead to force rerun of the migration job
        IGNORE_RERUN_NONCE: force ? Date.now().toString() : '0',
      },
    },
    [clickhouse.deployment, clickhouse.service, ...(dependencies || [])],
    clickhouse.service,
  ).deployAsJob();

  return job;
}
