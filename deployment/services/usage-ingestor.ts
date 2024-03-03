import * as pulumi from '@pulumi/pulumi';
import { DeploymentEnvironment } from '../types';
import { isProduction, isStaging } from '../utils/helpers';
import { ServiceDeployment } from '../utils/service-deployment';
import { Clickhouse } from './clickhouse';
import { DbMigrations } from './db-migrations';
import { Docker } from './docker';
import { Kafka } from './kafka';

export type UsageIngestor = ReturnType<typeof deployUsageIngestor>;

export function deployUsageIngestor({
  deploymentEnv,
  clickhouse,
  kafka,
  dbMigrations,
  heartbeat,
  image,
  release,
  docker,
}: {
  image: string;
  release: string;
  deploymentEnv: DeploymentEnvironment;
  clickhouse: Clickhouse;
  kafka: Kafka;
  dbMigrations: DbMigrations;
  heartbeat?: string;
  docker: Docker;
}) {
  const commonConfig = new pulumi.Config('common');
  const commonEnv = commonConfig.requireObject<Record<string, string>>('env');
  const clickHouseConfig = new pulumi.Config('clickhouse');
  const numberOfPartitions = 16;
  const replicas = isProduction(deploymentEnv) ? 6 : 1;
  const cpuLimit = isProduction(deploymentEnv) ? '600m' : '300m';
  const maxReplicas = isProduction(deploymentEnv) ? numberOfPartitions : 2;

  // Require migrationV2DataIngestionStartDate only in production and staging
  // Remove it once we are done with migration.
  const clickHouseMigrationV2DataIngestionStartDate =
    isProduction(deploymentEnv) || isStaging(deploymentEnv)
      ? clickHouseConfig.require('migrationV2DataIngestionStartDate')
      : '';

  return new ServiceDeployment(
    'usage-ingestor-service',
    {
      image,
      imagePullSecret: docker.secret,
      replicas,
      readinessProbe: '/_readiness',
      livenessProbe: '/_health',
      availabilityOnEveryNode: true,
      env: {
        ...deploymentEnv,
        ...commonEnv,
        SENTRY: commonEnv.SENTRY_ENABLED,
        CLICKHOUSE_ASYNC_INSERT_BUSY_TIMEOUT_MS: '30000', // flush data after max 30 seconds
        CLICKHOUSE_ASYNC_INSERT_MAX_DATA_SIZE: '200000000', // flush data when the buffer reaches 200MB
        KAFKA_SASL_MECHANISM: kafka.config.saslMechanism,
        KAFKA_CONCURRENCY: kafka.config.concurrency,
        KAFKA_TOPIC: kafka.config.topic,
        KAFKA_CONSUMER_GROUP: kafka.config.consumerGroup,
        RELEASE: release,
        HEARTBEAT_ENDPOINT: heartbeat ?? '',
        MIGRATION_V2_INGEST_AFTER_UTC: clickHouseMigrationV2DataIngestionStartDate,
      },
      exposesMetrics: true,
      port: 4000,
      pdb: true,
      autoScaling: {
        cpu: {
          cpuAverageToScale: 60,
          limit: cpuLimit,
        },
        maxReplicas,
      },
    },
    [clickhouse.deployment, clickhouse.service, dbMigrations].filter(Boolean),
  )
    .withSecret('CLICKHOUSE_HOST', clickhouse.secret, 'host')
    .withSecret('CLICKHOUSE_PORT', clickhouse.secret, 'port')
    .withSecret('CLICKHOUSE_USERNAME', clickhouse.secret, 'username')
    .withSecret('CLICKHOUSE_PASSWORD', clickhouse.secret, 'password')
    .withSecret('CLICKHOUSE_PROTOCOL', clickhouse.secret, 'protocol')
    .withSecret('KAFKA_SASL_USERNAME', kafka.secret, 'saslUsername')
    .withSecret('KAFKA_SASL_PASSWORD', kafka.secret, 'saslPassword')
    .withSecret('KAFKA_SSL', kafka.secret, 'ssl')
    .withSecret('KAFKA_BROKER', kafka.secret, 'endpoint')
    .deploy();
}
