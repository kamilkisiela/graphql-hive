import { parse } from 'pg-connection-string';
import * as k8s from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import { DeploymentEnvironment } from '../types';
import { isProduction } from '../utils/helpers';
import { serviceLocalEndpoint } from '../utils/local-endpoint';
import { ServiceDeployment } from '../utils/service-deployment';
import { DbMigrations } from './db-migrations';
import { UsageEstimator } from './usage-estimation';

const billingConfig = new pulumi.Config('billing');
const commonConfig = new pulumi.Config('common');
const commonEnv = commonConfig.requireObject<Record<string, string>>('env');
const apiConfig = new pulumi.Config('api');

export type StripeBillingService = ReturnType<typeof deployStripeBilling>;

export function deployStripeBilling({
  deploymentEnv,
  dbMigrations,
  usageEstimator,
  image,
  release,
  imagePullSecret,
}: {
  usageEstimator: UsageEstimator;
  image: string;
  release: string;
  deploymentEnv: DeploymentEnvironment;
  dbMigrations: DbMigrations;
  imagePullSecret: k8s.core.v1.Secret;
}) {
  const rawConnectionString = apiConfig.requireSecret('postgresConnectionString');
  const connectionString = rawConnectionString.apply(rawConnectionString =>
    parse(rawConnectionString),
  );

  return new ServiceDeployment(
    'stripe-billing',
    {
      image,
      imagePullSecret,
      replicas: isProduction(deploymentEnv) ? 3 : 1,
      readinessProbe: '/_readiness',
      livenessProbe: '/_health',
      env: {
        ...deploymentEnv,
        ...commonEnv,
        SENTRY: commonEnv.SENTRY_ENABLED,
        RELEASE: release,
        USAGE_ESTIMATOR_ENDPOINT: serviceLocalEndpoint(usageEstimator.service),
        STRIPE_SECRET_KEY: billingConfig.requireSecret('stripePrivateKey'),
        POSTGRES_HOST: connectionString.apply(connection => connection.host ?? ''),
        POSTGRES_PORT: connectionString.apply(connection => connection.port || '5432'),
        POSTGRES_PASSWORD: connectionString.apply(connection => connection.password ?? ''),
        POSTGRES_USER: connectionString.apply(connection => connection.user ?? ''),
        POSTGRES_DB: connectionString.apply(connection => connection.database ?? ''),
        POSTGRES_SSL: connectionString.apply(connection => (connection.ssl ? '1' : '0')),
      },
      exposesMetrics: true,
      port: 4000,
    },
    [dbMigrations, usageEstimator.service, usageEstimator.deployment],
  ).deploy();
}
