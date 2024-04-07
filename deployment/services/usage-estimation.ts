import { ServiceDeployment } from '../utils/service-deployment';
import { Clickhouse } from './clickhouse';
import { DbMigrations } from './db-migrations';
import { Docker } from './docker';
import { Environment } from './environment';
import { Observability } from './observability';
import { Sentry } from './sentry';

export type UsageEstimator = ReturnType<typeof deployUsageEstimation>;

export function deployUsageEstimation({
  image,
  docker,
  environment,
  clickhouse,
  dbMigrations,
  sentry,
  observability,
}: {
  observability: Observability;
  image: string;
  docker: Docker;
  environment: Environment;
  clickhouse: Clickhouse;
  dbMigrations: DbMigrations;
  sentry: Sentry;
}) {
  return new ServiceDeployment(
    'usage-estimator',
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
    .withSecret('CLICKHOUSE_HOST', clickhouse.secret, 'host')
    .withSecret('CLICKHOUSE_PORT', clickhouse.secret, 'port')
    .withSecret('CLICKHOUSE_USERNAME', clickhouse.secret, 'username')
    .withSecret('CLICKHOUSE_PASSWORD', clickhouse.secret, 'password')
    .withSecret('CLICKHOUSE_PROTOCOL', clickhouse.secret, 'protocol')
    .withConditionalSecret(sentry.enabled, 'SENTRY_DSN', sentry.secret, 'dsn')
    .deploy();
}
