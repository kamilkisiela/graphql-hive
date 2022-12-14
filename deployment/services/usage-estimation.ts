import * as pulumi from '@pulumi/pulumi';
import { ServiceDeployment } from '../utils/service-deployment';
import { DeploymentEnvironment } from '../types';
import { Clickhouse } from './clickhouse';
import { DbMigrations } from './db-migrations';
import * as k8s from '@pulumi/kubernetes';

const commonConfig = new pulumi.Config('common');
const commonEnv = commonConfig.requireObject<Record<string, string>>('env');

export type UsageEstimator = ReturnType<typeof deployUsageEstimation>;

export function deployUsageEstimation({
  image,
  imagePullSecret,
  release,
  deploymentEnv,
  clickhouse,
  dbMigrations,
}: {
  image: string;
  imagePullSecret: k8s.core.v1.Secret;
  release: string;
  deploymentEnv: DeploymentEnvironment;
  clickhouse: Clickhouse;
  dbMigrations: DbMigrations;
}) {
  return new ServiceDeployment(
    'usage-estimator',
    {
      image,
      imagePullSecret,
      replicas: 1,
      readinessProbe: '/_readiness',
      livenessProbe: '/_health',
      env: {
        ...deploymentEnv,
        ...commonEnv,
        SENTRY: commonEnv.SENTRY_ENABLED,
        CLICKHOUSE_PROTOCOL: clickhouse.config.protocol,
        CLICKHOUSE_HOST: clickhouse.config.host,
        CLICKHOUSE_PORT: clickhouse.config.port,
        CLICKHOUSE_USERNAME: clickhouse.config.username,
        CLICKHOUSE_PASSWORD: clickhouse.config.password,
        RELEASE: release,
      },
      exposesMetrics: true,
      port: 4000,
    },
    [dbMigrations],
  ).deploy();
}
