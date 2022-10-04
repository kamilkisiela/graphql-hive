import * as pulumi from '@pulumi/pulumi';
import * as azure from '@pulumi/azure';
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
        RELEASE: packageHelper.currentReleaseId(),
        USAGE_ESTIMATOR_ENDPOINT: serviceLocalEndpoint(usageEstimator.service),
        STRIPE_SECRET_KEY: billingConfig.requireSecret('stripePrivateKey'),
        POSTGRES_CONNECTION_STRING: apiConfig.requireSecret('postgresConnectionString'),
      },
      exposesMetrics: true,
      packageInfo: packageHelper.npmPack('@hive/stripe-billing'),
      port: 4000,
    },
    [dbMigrations, usageEstimator.service, usageEstimator.deployment]
  ).deploy();
}
