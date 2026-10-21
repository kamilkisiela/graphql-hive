import * as pulumi from '@pulumi/pulumi';
import { ServiceSecret } from '../utils/secrets';
import { ServiceDeployment } from '../utils/service-deployment';
import { Clickhouse } from './clickhouse';
import { DbMigrations } from './db-migrations';
import { Docker } from './docker';
import { EgressPolicyManager } from './egress-policy';
import { Environment } from './environment';
import { Observability } from './observability';
import { Postgres } from './postgres';
import { Sentry } from './sentry';

export type CommerceService = ReturnType<typeof deployCommerce>;

class StripeSecret extends ServiceSecret<{
  stripePrivateKey: pulumi.Output<string> | string;
  stripePublicKey: string | pulumi.Output<string>;
}> {}

export function deployCommerce({
  observability,
  environment,
  dbMigrations,
  image,
  docker,
  postgres,
  clickhouse,
  sentry,
  egressManager,
}: {
  observability: Observability;
  image: string;
  environment: Environment;
  dbMigrations: DbMigrations;
  docker: Docker;
  postgres: Postgres;
  clickhouse: Clickhouse;
  sentry: Sentry;
  egressManager: EgressPolicyManager;
}) {
  const billingConfig = new pulumi.Config('billing');
  const stripeSecret = new StripeSecret('stripe', {
    stripePrivateKey: billingConfig.requireSecret('stripePrivateKey'),
    stripePublicKey: billingConfig.require('stripePublicKey'),
  });
  const { deployment, service } = new ServiceDeployment(
    'commerce',
    {
      image,
      imagePullSecret: docker.secret,
      replicas: environment.podsConfig.general.replicas,
      readinessProbe: '/_readiness',
      livenessProbe: '/_health',
      startupProbe: '/_health',
      env: {
        ...environment.envVars,
        SENTRY: sentry.enabled ? '1' : '0',
        WEB_APP_URL: `https://${environment.appDns}/`,
        OPENTELEMETRY_TRACE_USAGE_REQUESTS: observability.enabledForUsageService ? '1' : '',
        OPENTELEMETRY_COLLECTOR_ENDPOINT:
          observability.enabled && observability.tracingEndpoint
            ? observability.tracingEndpoint
            : '',
      },
      exposesMetrics: true,
      port: 4000,
    },
    [dbMigrations],
  )
    .withSecret('STRIPE_SECRET_KEY', stripeSecret, 'stripePrivateKey')
    .withSecret('POSTGRES_HOST', postgres.pgBouncerSecret, 'host')
    .withSecret('POSTGRES_PORT', postgres.pgBouncerSecret, 'port')
    .withSecret('POSTGRES_USER', postgres.pgBouncerSecret, 'user')
    .withSecret('POSTGRES_PASSWORD', postgres.pgBouncerSecret, 'password')
    .withSecret('POSTGRES_DB', postgres.pgBouncerSecret, 'database')
    .withSecret('POSTGRES_SSL', postgres.pgBouncerSecret, 'ssl')
    .withSecret('CLICKHOUSE_HOST', clickhouse.secret, 'host')
    .withSecret('CLICKHOUSE_PORT', clickhouse.secret, 'port')
    .withSecret('CLICKHOUSE_USERNAME', clickhouse.secret, 'username')
    .withSecret('CLICKHOUSE_PASSWORD', clickhouse.secret, 'password')
    .withSecret('CLICKHOUSE_PROTOCOL', clickhouse.secret, 'protocol')
    .withConditionalSecret(sentry.enabled, 'SENTRY_DSN', sentry.secret, 'dsn')
    .deploy();

  egressManager
    ?.allowExternal(
      deployment,
      postgres.pgBouncerSecret.raw.host,
      postgres.pgBouncerSecret.raw.port,
    )
    .allowExternal(deployment, clickhouse.secret.raw.host, clickhouse.secret.raw.port)
    .allowExternal(deployment, 'https://api.stripe.com')
    .allowExternal(deployment, sentry.secret?.raw.dsn)
    .allowInCluster(deployment, observability.observability?.otlpCollectorService);

  return {
    deployment,
    service,
    stripeSecret,
  };
}
