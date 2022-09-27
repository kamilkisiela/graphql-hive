import * as pulumi from '@pulumi/pulumi';
import * as azure from '@pulumi/azure';
import { RemoteArtifactAsServiceDeployment } from '../utils/remote-artifact-as-service';
import { PackageHelper } from '../utils/pack';
import { DeploymentEnvironment } from '../types';
import { Clickhouse } from './clickhouse';
import { DbMigrations } from './db-migrations';

const commonConfig = new pulumi.Config('common');
const commonEnv = commonConfig.requireObject<Record<string, string>>('env');
const apiConfig = new pulumi.Config('api');

export type UsageEstimator = ReturnType<typeof deployUsageEstimation>;

export function deployUsageEstimation({
  storageContainer,
  packageHelper,
  deploymentEnv,
  clickhouse,
  dbMigrations,
}: {
  storageContainer: azure.storage.Container;
  packageHelper: PackageHelper;
  deploymentEnv: DeploymentEnvironment;
  clickhouse: Clickhouse;
  dbMigrations: DbMigrations;
}) {
  return new RemoteArtifactAsServiceDeployment(
    'usage-estimator',
    {
      storageContainer,
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
        RELEASE: packageHelper.currentReleaseId(),
        POSTGRES_CONNECTION_STRING: apiConfig.requireSecret('postgresConnectionString'), // TODO: remove this
      },
      exposesMetrics: true,
      packageInfo: packageHelper.npmPack('@hive/usage-estimator'),
      port: 4000,
    },
    [dbMigrations]
  ).deploy();
}
