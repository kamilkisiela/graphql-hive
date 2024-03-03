import * as pulumi from '@pulumi/pulumi';
import { ServiceSecret } from '../secrets';
import { DeploymentEnvironment } from '../types';
import { isProduction } from '../utils/helpers';
import { serviceLocalEndpoint } from '../utils/local-endpoint';
import { ServiceDeployment } from '../utils/service-deployment';
import { DbMigrations } from './db-migrations';
import { Docker } from './docker';
import { Postgres } from './postgres';
import { UsageEstimator } from './usage-estimation';

export type StripeBillingService = ReturnType<typeof deployStripeBilling>;

class StripeSecret extends ServiceSecret<{
  stripePrivateKey: pulumi.Output<string> | string;
  stripePublicKey: string | pulumi.Output<string>;
}> {}

export function deployStripeBilling({
  deploymentEnv,
  dbMigrations,
  usageEstimator,
  image,
  release,
  docker,
  postgres,
}: {
  usageEstimator: UsageEstimator;
  image: string;
  release: string;
  deploymentEnv: DeploymentEnvironment;
  dbMigrations: DbMigrations;
  docker: Docker;
  postgres: Postgres;
}) {
  const billingConfig = new pulumi.Config('billing');
  const commonConfig = new pulumi.Config('common');
  const commonEnv = commonConfig.requireObject<Record<string, string>>('env');
  const appConfig = new pulumi.Config('app');
  const appEnv = appConfig.requireObject<Record<string, string>>('env');

  const stripeSecret = new StripeSecret('stripe', {
    stripePrivateKey: billingConfig.requireSecret('stripePrivateKey'),
    stripePublicKey: appEnv.STRIPE_PUBLIC_KEY,
  });
  const { deployment, service } = new ServiceDeployment(
    'stripe-billing',
    {
      image,
      imagePullSecret: docker.secret,
      replicas: isProduction(deploymentEnv) ? 3 : 1,
      readinessProbe: '/_readiness',
      livenessProbe: '/_health',
      startupProbe: '/_health',
      env: {
        ...deploymentEnv,
        ...commonEnv,
        SENTRY: commonEnv.SENTRY_ENABLED,
        RELEASE: release,
        USAGE_ESTIMATOR_ENDPOINT: serviceLocalEndpoint(usageEstimator.service),
      },
      exposesMetrics: true,
      port: 4000,
    },
    [dbMigrations, usageEstimator.service, usageEstimator.deployment],
  )
    .withSecret('STRIPE_SECRET_KEY', stripeSecret, 'stripePrivateKey')
    .withSecret('POSTGRES_HOST', postgres.secret, 'host')
    .withSecret('POSTGRES_PORT', postgres.secret, 'port')
    .withSecret('POSTGRES_USER', postgres.secret, 'user')
    .withSecret('POSTGRES_PASSWORD', postgres.secret, 'password')
    .withSecret('POSTGRES_DB', postgres.secret, 'database')
    .withSecret('POSTGRES_SSL', postgres.secret, 'ssl')
    .deploy();

  return {
    deployment,
    service,
    secret: stripeSecret,
  };
}

export type StripeBilling = ReturnType<typeof deployStripeBilling>;
