import * as pulumi from '@pulumi/pulumi';
import * as azure from '@pulumi/azure';
import { parse } from 'pg-connection-string';
import { RemoteArtifactAsServiceDeployment } from '../utils/remote-artifact-as-service';
import { PackageHelper } from '../utils/pack';
import { DeploymentEnvironment } from '../types';
import { DbMigrations } from './db-migrations';
import { UsageEstimator } from './usage-estimation';
import { serviceLocalEndpoint } from '../utils/local-endpoint';

const billingConfig = new pulumi.Config('billing');
const commonConfig = new pulumi.Config('common');
const commonEnv = commonConfig.requireObject<Record<string, string>>('env');
const apiConfig = new pulumi.Config('api');

export type StripeBillingService = ReturnType<typeof deployStripeBilling>;

export function deployStripeBilling({
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
  const rawConnectionString = apiConfig.requireSecret('postgresConnectionString');
  const connectionString = rawConnectionString.apply(rawConnectionString =>
    parse(rawConnectionString),
  );

  return new RemoteArtifactAsServiceDeployment(
    'stripe-billing',
    {
      storageContainer,
      replicas: 1,
      readinessProbe: '/_readiness',
      livenessProbe: '/_health',
      env: {
        ...deploymentEnv,
        ...commonEnv,
        SENTRY: commonEnv.SENTRY_ENABLED,
        RELEASE: packageHelper.currentReleaseId(),
        USAGE_ESTIMATOR_ENDPOINT: serviceLocalEndpoint(usageEstimator.service),
        STRIPE_SECRET_KEY: billingConfig.requireSecret('stripePrivateKey'),
        POSTGRES_HOST: connectionString.apply(connection => connection.host ?? ''),
        POSTGRES_PORT: connectionString.apply(connection => connection.port ?? '5432'),
        POSTGRES_PASSWORD: connectionString.apply(connection => connection.password ?? ''),
        POSTGRES_USER: connectionString.apply(connection => connection.user ?? ''),
        POSTGRES_DB: connectionString.apply(connection => connection.database ?? ''),
        POSTGRES_SSL: connectionString.apply(connection => (connection.ssl ? '1' : '0')),
      },
      exposesMetrics: true,
      packageInfo: packageHelper.npmPack('@hive/stripe-billing'),
      port: 4000,
    },
    [dbMigrations, usageEstimator.service, usageEstimator.deployment],
  ).deploy();
}
