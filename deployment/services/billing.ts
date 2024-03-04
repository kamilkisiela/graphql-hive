import * as pulumi from '@pulumi/pulumi';
import { serviceLocalEndpoint } from '../utils/local-endpoint';
import { ServiceSecret } from '../utils/secrets';
import { ServiceDeployment } from '../utils/service-deployment';
import { DbMigrations } from './db-migrations';
import { Docker } from './docker';
import { Environment } from './environment';
import { Postgres } from './postgres';
import { Sentry } from './sentry';
import { UsageEstimator } from './usage-estimation';

export type StripeBillingService = ReturnType<typeof deployStripeBilling>;

class StripeSecret extends ServiceSecret<{
  stripePrivateKey: pulumi.Output<string> | string;
  stripePublicKey: string | pulumi.Output<string>;
}> {}

export function deployStripeBilling({
  environment,
  dbMigrations,
  usageEstimator,
  image,
  docker,
  postgres,
  sentry,
}: {
  usageEstimator: UsageEstimator;
  image: string;
  environment: Environment;
  dbMigrations: DbMigrations;
  docker: Docker;
  postgres: Postgres;
  sentry: Sentry;
}) {
  const billingConfig = new pulumi.Config('billing');
  const stripeSecret = new StripeSecret('stripe', {
    stripePrivateKey: billingConfig.requireSecret('stripePrivateKey'),
    stripePublicKey: billingConfig.require('stripePublicKey'),
  });
  const { deployment, service } = new ServiceDeployment(
    'stripe-billing',
    {
      image,
      imagePullSecret: docker.secret,
      replicas: environment.isProduction ? 3 : 1,
      readinessProbe: '/_readiness',
      livenessProbe: '/_health',
      startupProbe: '/_health',
      env: {
        ...environment.envVars,
        SENTRY: sentry.enabled ? '1' : '0',
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
    .withConditionalSecret(sentry.enabled, 'SENTRY_DSN', sentry.secret, 'dsn')
    .deploy();

  return {
    deployment,
    service,
    secret: stripeSecret,
  };
}

export type StripeBilling = ReturnType<typeof deployStripeBilling>;
