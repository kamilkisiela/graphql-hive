import * as k8s from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import { DeploymentEnvironment } from '../types';
import { isProduction } from '../utils/helpers';
import { ServiceDeployment } from '../utils/service-deployment';
import { Clickhouse } from './clickhouse';
import { DbMigrations } from './db-migrations';
import { Kafka } from './kafka';

const commonConfig = new pulumi.Config('common');
const commonEnv = commonConfig.requireObject<Record<string, string>>('env');

export type UsageIngestor = ReturnType<typeof deployUsageIngestor>;

export function deployUsageIngestor({
  deploymentEnv,
  clickhouse,
  kafka,
  dbMigrations,
  heartbeat,
  image,
  release,
  imagePullSecret,
}: {
  image: string;
  release: string;
  deploymentEnv: DeploymentEnvironment;
  clickhouse: Clickhouse;
  kafka: Kafka;
  dbMigrations: DbMigrations;
  heartbeat?: string;
  imagePullSecret: k8s.core.v1.Secret;
}) {
  const numberOfPartitions = 6;
  const replicas = isProduction(deploymentEnv) ? 6 : 1;
  const cpuLimit = isProduction(deploymentEnv) ? '600m' : '300m';
  const maxReplicas = isProduction(deploymentEnv) ? numberOfPartitions : 2;

  const clickhouseEnv = {
    CLICKHOUSE_PROTOCOL: clickhouse.config.protocol,
    CLICKHOUSE_HOST: clickhouse.config.host,
    CLICKHOUSE_PORT: clickhouse.config.port,
    CLICKHOUSE_USERNAME: clickhouse.config.username,
    CLICKHOUSE_PASSWORD: clickhouse.config.password,
    CLICKHOUSE_ASYNC_INSERT_BUSY_TIMEOUT_MS: '30000', // flush data after max 30 seconds
    CLICKHOUSE_ASYNC_INSERT_MAX_DATA_SIZE: '200000000', // flush data when the buffer reaches 200MB
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

  return new ServiceDeployment(
    'usage-ingestor-service',
    {
      image,
      imagePullSecret,
      replicas,
      readinessProbe: '/_readiness',
      livenessProbe: '/_health',
      env: {
        ...deploymentEnv,
        ...commonEnv,
        SENTRY: commonEnv.SENTRY_ENABLED,
        ...clickhouseEnv,
        ...kafka.connectionEnv,
        KAFKA_BROKER: kafka.config.endpoint,
        KAFKA_TOPIC: kafka.config.topic,
        KAFKA_CONSUMER_GROUP: kafka.config.consumerGroup,
        RELEASE: release,
        HEARTBEAT_ENDPOINT: heartbeat ?? '',
      },
      exposesMetrics: true,
      port: 4000,
      pdb: true,
      autoScaling: {
        cpu: {
          cpuAverageToScale: 60,
          limit: cpuLimit,
        },
        maxReplicas: maxReplicas,
      },
    },
    [
      clickhouse.deployment,
      clickhouse.service,
      dbMigrations,
      kafka.deployment,
      kafka.service,
    ].filter(Boolean),
  ).deploy();
}
