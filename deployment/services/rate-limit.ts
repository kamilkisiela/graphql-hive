import * as pulumi from '@pulumi/pulumi';
import * as azure from '@pulumi/azure';
import { parse } from 'pg-connection-string';
import { RemoteArtifactAsServiceDeployment } from '../utils/remote-artifact-as-service';
import { PackageHelper } from '../utils/pack';
import { DeploymentEnvironment } from '../types';
import { DbMigrations } from './db-migrations';
import { UsageEstimator } from './usage-estimation';
import { Emails } from './emails';
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
  emails,
}: {
  usageEstimator: UsageEstimator;
  storageContainer: azure.storage.Container;
  packageHelper: PackageHelper;
  deploymentEnv: DeploymentEnvironment;
  dbMigrations: DbMigrations;
  emails: Emails;
}) {
  const rawConnectionString = apiConfig.requireSecret('postgresConnectionString');
  const connectionString = rawConnectionString.apply(rawConnectionString =>
    parse(rawConnectionString),
  );

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
        SENTRY: commonEnv.SENTRY_ENABLED,
        LIMIT_CACHE_UPDATE_INTERVAL_MS: rateLimitConfig.require('updateIntervalMs'),
        RELEASE: packageHelper.currentReleaseId(),
        USAGE_ESTIMATOR_ENDPOINT: serviceLocalEndpoint(usageEstimator.service),
        EMAILS_ENDPOINT: serviceLocalEndpoint(emails.service),
        POSTGRES_HOST: connectionString.apply(connection => connection.host ?? ''),
        POSTGRES_PORT: connectionString.apply(connection => connection.port ?? '5432'),
        POSTGRES_PASSWORD: connectionString.apply(connection => connection.password ?? ''),
        POSTGRES_USER: connectionString.apply(connection => connection.user ?? ''),
        POSTGRES_DB: connectionString.apply(connection => connection.database ?? ''),
        POSTGRES_SSL: connectionString.apply(connection => (connection.ssl ? '1' : '0')),
      },
      exposesMetrics: true,
      packageInfo: packageHelper.npmPack('@hive/rate-limit'),
      port: 4000,
    },
    [dbMigrations, usageEstimator.service, usageEstimator.deployment],
  ).deploy();
}
