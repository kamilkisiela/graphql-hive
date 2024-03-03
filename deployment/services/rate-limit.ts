import { serviceLocalEndpoint } from '../utils/local-endpoint';
import { ServiceDeployment } from '../utils/service-deployment';
import { DbMigrations } from './db-migrations';
import { Docker } from './docker';
import { Emails } from './emails';
import { Environment } from './environment';
import { Postgres } from './postgres';
import { Sentry } from './sentry';
import { UsageEstimator } from './usage-estimation';

export type RateLimitService = ReturnType<typeof deployRateLimit>;

export function deployRateLimit({
  environment,
  dbMigrations,
  usageEstimator,
  emails,
  image,
  docker,
  postgres,
  sentry,
}: {
  usageEstimator: UsageEstimator;
  environment: Environment;
  dbMigrations: DbMigrations;
  emails: Emails;
  image: string;
  docker: Docker;
  postgres: Postgres;
  sentry: Sentry;
}) {
  return new ServiceDeployment(
    'rate-limiter',
    {
      imagePullSecret: docker.secret,
      replicas: environment.isProduction ? 3 : 1,
      readinessProbe: '/_readiness',
      livenessProbe: '/_health',
      startupProbe: '/_health',
      env: {
        ...environment.env,
        SENTRY: sentry.enabled ? '1' : '0',
        LIMIT_CACHE_UPDATE_INTERVAL_MS: environment.isProduction ? '60000' : '86400000',
        USAGE_ESTIMATOR_ENDPOINT: serviceLocalEndpoint(usageEstimator.service),
        EMAILS_ENDPOINT: serviceLocalEndpoint(emails.service),
        WEB_APP_URL: `https://${environment.appDns}/`,
      },
      exposesMetrics: true,
      port: 4000,
      image,
    },
    [dbMigrations, usageEstimator.service, usageEstimator.deployment],
  )
    .withSecret('POSTGRES_HOST', postgres.secret, 'host')
    .withSecret('POSTGRES_PORT', postgres.secret, 'port')
    .withSecret('POSTGRES_USER', postgres.secret, 'user')
    .withSecret('POSTGRES_PASSWORD', postgres.secret, 'password')
    .withSecret('POSTGRES_DB', postgres.secret, 'database')
    .withSecret('POSTGRES_SSL', postgres.secret, 'ssl')
    .withConditionalSecret(sentry.enabled, 'SENTRY_DSN', sentry.secret, 'dsn')
    .deploy();
}
