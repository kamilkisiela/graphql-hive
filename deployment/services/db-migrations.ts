import { parse } from 'pg-connection-string';
import * as k8s from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
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
  s3,
  cdnAuthPrivateKey,
}: {
  deploymentEnv: DeploymentEnvironment;
  clickhouse: Clickhouse;
  kafka: Kafka;
  image: string;
  imagePullSecret: k8s.core.v1.Secret;
  dependencies?: pulumi.Resource[];
  force?: boolean;
  s3: {
    accessKeyId: string | pulumi.Output<string>;
    secretAccessKey: string | pulumi.Output<string>;
    endpoint: string | pulumi.Output<string>;
    bucketName: string | pulumi.Output<string>;
  };
  cdnAuthPrivateKey: pulumi.Output<string>;
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
        POSTGRES_PORT: connectionString.apply(connection => connection.port || '5432'),
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
        CLICKHOUSE_MIGRATOR_GRAPHQL_HIVE_CLOUD: '1',
        KAFKA_BROKER: kafka.config.endpoint,
        TS_NODE_TRANSPILE_ONLY: 'true',
        RUN_S3_LEGACY_CDN_KEY_IMPORT: '1',
        S3_ACCESS_KEY_ID: s3.accessKeyId,
        S3_SECRET_ACCESS_KEY: s3.secretAccessKey,
        S3_ENDPOINT: s3.endpoint,
        S3_BUCKET_NAME: s3.bucketName,
        CDN_AUTH_PRIVATE_KEY: cdnAuthPrivateKey,
        ...deploymentEnv,
        // Change to this env var will lead to force rerun of the migration job
        // Since K8s job are immutable, we can't edit or ask K8s to re-run a Job, so we are doing a
        // pseudo change to an env var, which causes Pulumi to re-create the Job.
        IGNORE_RERUN_NONCE: force ? Date.now().toString() : '0',
      },
    },
    [clickhouse.deployment, clickhouse.service, ...(dependencies || [])],
    clickhouse.service,
  ).deployAsJob();

  return job;
}
