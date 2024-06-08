import * as pulumi from '@pulumi/pulumi';
import { serviceLocalEndpoint } from '../utils/local-endpoint';
import { ServiceSecret } from '../utils/secrets';
import { ServiceDeployment } from '../utils/service-deployment';
import { DbMigrations } from './db-migrations';
import { Docker } from './docker';
import { Environment } from './environment';
import { Observability } from './observability';
import { Sentry } from './sentry';
import { UsageEstimator } from './usage-estimation';

export type PaddleBillingService = ReturnType<typeof deployPaddleBilling>;

class PaddleSecret extends ServiceSecret<{
  paddleApiKey: pulumi.Output<string> | string;
  paddleClientSideToken: string | pulumi.Output<string>;
  paddleWebhookSecret: string | pulumi.Output<string>;
}> {}

export function deployPaddleBilling({
  observability,
  environment,
  dbMigrations,
  usageEstimator,
  image,
  docker,
  sentry,
}: {
  observability: Observability;
  usageEstimator: UsageEstimator;
  image: string;
  environment: Environment;
  dbMigrations: DbMigrations;
  docker: Docker;
  sentry: Sentry;
}) {
  const billingConfig = new pulumi.Config('paddle');
  const paddleSecret = new PaddleSecret('paddle', {
    paddleApiKey: billingConfig.requireSecret('apiKey'),
    paddleClientSideToken: billingConfig.requireSecret('clientSideToken'),
    paddleWebhookSecret: billingConfig.requireSecret('webhookSecret'),
  });
  const { deployment, service } = new ServiceDeployment(
    'paddle-billing',
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
        PADDLE_ENVIRONMENT: environment.isProduction ? 'production' : 'sandbox',
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
    .withSecret('PADDLE_API_KEY', paddleSecret, 'paddleApiKey')
    .withSecret('PADDLE_WEBHOOK_SECRET', paddleSecret, 'paddleWebhookSecret')
    .withConditionalSecret(sentry.enabled, 'SENTRY_DSN', sentry.secret, 'dsn')
    .deploy();

  return {
    deployment,
    service,
    secret: paddleSecret,
  };
}

export type PaddleBilling = ReturnType<typeof deployPaddleBilling>;
