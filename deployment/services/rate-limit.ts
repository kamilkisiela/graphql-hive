import * as pulumi from '@pulumi/pulumi';
import * as azure from '@pulumi/azure';
import { RemoteArtifactAsServiceDeployment } from '../utils/remote-artifact-as-service';
import { PackageHelper } from '../utils/pack';
import { DeploymentEnvironment } from '../types';
import { DbMigrations } from './db-migrations';
import { UsageEstimator } from './usage-estimation';
import { serviceLocalEndpoint } from '../utils/local-endpoint';

const rateLimitConfig = new pulumi.Config('rateLimit');
const commonConfig = new pulumi.Config('common');
const commonEnv = commonConfig.requireObject<Record<string, string>>('env');
const apiConfig = new pulumi.Config('api');

export type RateLimitService = ReturnType<typeof deployRateLimit>;

export function deployRateLimit({
  storageContainer,
  packageHelper,
  deploymentEnv,
  dbMigrations,
  usageEstimator,
}: {
  usageEstimator: UsageEstimator;
  storageContainer: azure.storage.Container;
  packageHelper: PackageHelper;
  deploymentEnv: DeploymentEnvironment;
  dbMigrations: DbMigrations;
}) {
  return new RemoteArtifactAsServiceDeployment(
    'rate-limiter',
    {
      storageContainer,
      replicas: 1,
      readinessProbe: '/_readiness',
      livenessProbe: '/_health',
      env: {
        ...deploymentEnv,
        ...commonEnv,
        LIMIT_CACHE_UPDATE_INTERVAL_MS: rateLimitConfig.require('updateIntervalMs'),
        RELEASE: packageHelper.currentReleaseId(),
        USAGE_ESTIMATOR_ENDPOINT: serviceLocalEndpoint(usageEstimator.service),
        POSTGRES_CONNECTION_STRING: apiConfig.requireSecret('postgresConnectionString'),
      },
      exposesMetrics: true,
      packageInfo: packageHelper.npmPack('@hive/rate-limit'),
      port: 4000,
    },
    [dbMigrations, usageEstimator.service, usageEstimator.deployment]
  ).deploy();
}
