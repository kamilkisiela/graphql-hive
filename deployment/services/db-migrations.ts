import * as pulumi from '@pulumi/pulumi';
import { ServiceDeployment } from '../utils/service-deployment';
import { CDN } from './cf-cdn';
import { Clickhouse } from './clickhouse';
import { Docker } from './docker';
import { Environment } from './environment';
import { Postgres } from './postgres';
import { S3 } from './s3';

export type DbMigrations = ReturnType<typeof deployDbMigrations>;

export function deployDbMigrations({
  environment,
  clickhouse,
  s3,
  image,
  dependencies,
  force,
  docker,
  postgres,
  cdn,
}: {
  docker: Docker;
  postgres: Postgres;
  clickhouse: Clickhouse;
  s3: S3;
  cdn: CDN;
  environment: Environment;
  image: string;
  dependencies?: pulumi.Resource[];
  force?: boolean;
}) {
  const { job } = new ServiceDeployment(
    'db-migrations',
    {
      imagePullSecret: docker.secret,
      image,
      env: {
        ...environment.env,
        MIGRATOR: 'up',
        CLICKHOUSE_MIGRATOR: 'up',
        CLICKHOUSE_MIGRATOR_GRAPHQL_HIVE_CLOUD: '1',
        TS_NODE_TRANSPILE_ONLY: 'true',
        RUN_S3_LEGACY_CDN_KEY_IMPORT: '1',
        // Change to this env var will lead to force rerun of the migration job
        // Since K8s job are immutable, we can't edit or ask K8s to re-run a Job, so we are doing a
        // pseudo change to an env var, which causes Pulumi to re-create the Job.
        IGNORE_RERUN_NONCE: force ? Date.now().toString() : '0',
      },
    },
    [clickhouse.deployment, clickhouse.service, ...(dependencies || [])],
    clickhouse.service,
  )
    .withSecret('POSTGRES_HOST', postgres.secret, 'host')
    .withSecret('POSTGRES_PORT', postgres.secret, 'port')
    .withSecret('POSTGRES_USER', postgres.secret, 'user')
    .withSecret('POSTGRES_PASSWORD', postgres.secret, 'password')
    .withSecret('POSTGRES_DB', postgres.secret, 'database')
    .withSecret('POSTGRES_SSL', postgres.secret, 'ssl')
    .withSecret('CLICKHOUSE_HOST', clickhouse.secret, 'host')
    .withSecret('CLICKHOUSE_PORT', clickhouse.secret, 'port')
    .withSecret('CLICKHOUSE_USERNAME', clickhouse.secret, 'username')
    .withSecret('CLICKHOUSE_PASSWORD', clickhouse.secret, 'password')
    .withSecret('CLICKHOUSE_PROTOCOL', clickhouse.secret, 'protocol')
    .withSecret('S3_ACCESS_KEY_ID', s3.secret, 'accessKeyId')
    .withSecret('S3_SECRET_ACCESS_KEY', s3.secret, 'secretAccessKey')
    .withSecret('S3_BUCKET_NAME', s3.secret, 'bucket')
    .withSecret('S3_ENDPOINT', s3.secret, 'endpoint')
    .withSecret('CDN_AUTH_PRIVATE_KEY', cdn.secret, 'authPrivateKey')
    .deployAsJob();

  return job;
}
