import * as pulumi from '@pulumi/pulumi';
import { serviceLocalEndpoint } from '../utils/local-endpoint';
import { ServiceSecret } from '../utils/secrets';
import { ServiceDeployment } from '../utils/service-deployment';
import { DbMigrations } from './db-migrations';
import { Docker } from './docker';
import { Environment } from './environment';
import { Observability } from './observability';
import { Postgres } from './postgres';
import { Sentry } from './sentry';
import { UsageEstimator } from './usage-estimation';

export type StripeBillingService = ReturnType<typeof deployStripeBilling>;

class StripeSecret extends ServiceSecret<{
  stripePrivateKey: pulumi.Output<string> | string;
  stripePublicKey: string | pulumi.Output<string>;
}> {}

export function deployStripeBilling({
  observability,
  environment,
  dbMigrations,
  usageEstimator,
  image,
  docker,
  postgres,
  sentry,
}: {
  observability: Observability;
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
        OPENTELEMETRY_COLLECTOR_ENDPOINT:
          observability.enabled && observability.tracingEndpoint
            ? observability.tracingEndpoint
            : '',
      },
      exposesMetrics: true,
      port: 4000,
    },
    [dbMigrations, usageEstimator.service, usageEstimator.deployment],
  )
    .withSecret('STRIPE_SECRET_KEY', stripeSecret, 'stripePrivateKey')
    .withSecret('POSTGRES_HOST', postgres.pgBouncerSecret, 'host')
    .withSecret('POSTGRES_PORT', postgres.pgBouncerSecret, 'port')
    .withSecret('POSTGRES_USER', postgres.pgBouncerSecret, 'user')
    .withSecret('POSTGRES_PASSWORD', postgres.pgBouncerSecret, 'password')
    .withSecret('POSTGRES_DB', postgres.pgBouncerSecret, 'database')
    .withSecret('POSTGRES_SSL', postgres.pgBouncerSecret, 'ssl')
    .withConditionalSecret(sentry.enabled, 'SENTRY_DSN', sentry.secret, 'dsn')
    .deploy();

  return {
    deployment,
    service,
    secret: stripeSecret,
  };
}

export type StripeBilling = ReturnType<typeof deployStripeBilling>;
