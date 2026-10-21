import * as pulumi from '@pulumi/pulumi';
import { serviceLocalEndpoint } from '../utils/local-endpoint';
import { ServiceSecret } from '../utils/secrets';
import { ServiceDeployment } from '../utils/service-deployment';
import { Clickhouse } from './clickhouse';
import { DbMigrations } from './db-migrations';
import { Docker } from './docker';
import { EgressPolicyManager } from './egress-policy';
import { Environment } from './environment';
import { Observability } from './observability';
import { Postgres } from './postgres';
import { Redis } from './redis';
import { Schema } from './schema';
import { Sentry } from './sentry';

export class PostmarkSecret extends ServiceSecret<{
  token: pulumi.Output<string> | string;
  from: string;
  messageStream: string;
}> {}

export function deployWorkflows({
  environment,
  heartbeat,
  image,
  docker,
  sentry,
  postgres,
  observability,
  postmarkSecret,
  schema,
  redis,
  clickhouse,
  dbMigrations,
  egressManager,
}: {
  postgres: Postgres;
  observability: Observability;
  environment: Environment;
  image: string;
  docker: Docker;
  heartbeat?: string;
  sentry: Sentry;
  postmarkSecret: PostmarkSecret;
  schema: Schema;
  redis: Redis;
  clickhouse: Clickhouse;
  dbMigrations: DbMigrations;
  egressManager: EgressPolicyManager;
}) {
  const { deployment, service } = new ServiceDeployment(
    'workflow-service',
    {
      imagePullSecret: docker.secret,
      env: {
        ...environment.envVars,
        SENTRY: sentry.enabled ? '1' : '0',
        EMAIL_PROVIDER: 'postmark',
        HEARTBEAT_ENDPOINT: heartbeat ?? '',
        OPENTELEMETRY_COLLECTOR_ENDPOINT:
          observability.enabled && observability.tracingEndpoint
            ? observability.tracingEndpoint
            : '',
        LOG_JSON: '1',
        SCHEMA_ENDPOINT: serviceLocalEndpoint(schema.service),
        // Lets metric-alert notifications link back to the rule in Hive Console.
        WEB_APP_URL: `https://${environment.appDns}`,
        // Activate the ClickHouse client; without this toggle the workflows
        // env model picks the CLICKHOUSE-disabled union variant and
        // `env.clickhouse` resolves to null, which makes the
        // `evaluateMetricAlertRules` cron silently bail every minute even
        // when the secret values below are wired in correctly.
        CLICKHOUSE: '1',
      },
      readinessProbe: '/_readiness',
      livenessProbe: '/_health',
      startupProbe: '/_health',
      exposesMetrics: true,
      image,
      replicas: environment.podsConfig.general.replicas,
    },
    // Depend on dbMigrations so the ClickHouse migration (operations_by_target_daily)
    // runs before this service routes long-window queries to it.
    [dbMigrations, redis.deployment, redis.service],
  )
    // PG
    .withSecret('POSTGRES_HOST', postgres.pgBouncerSecret, 'host')
    .withSecret('POSTGRES_PORT', postgres.pgBouncerSecret, 'port')
    .withSecret('POSTGRES_USER', postgres.pgBouncerSecret, 'user')
    .withSecret('POSTGRES_PASSWORD', postgres.pgBouncerSecret, 'password')
    .withSecret('POSTGRES_DB', postgres.pgBouncerSecret, 'database')
    .withSecret('POSTGRES_SSL', postgres.pgBouncerSecret, 'ssl')
    .withSecret('EMAIL_FROM', postmarkSecret, 'from')
    .withSecret('EMAIL_PROVIDER_POSTMARK_TOKEN', postmarkSecret, 'token')
    .withSecret('EMAIL_PROVIDER_POSTMARK_MESSAGE_STREAM', postmarkSecret, 'messageStream')
    .withConditionalSecret(sentry.enabled, 'SENTRY_DSN', sentry.secret, 'dsn')
    // Redis
    .withSecret('REDIS_HOST', redis.secret, 'host')
    .withSecret('REDIS_PORT', redis.secret, 'port')
    .withSecret('REDIS_PASSWORD', redis.secret, 'password')
    // ClickHouse — required by `evaluateMetricAlertRules` task
    .withSecret('CLICKHOUSE_HOST', clickhouse.secret, 'host')
    .withSecret('CLICKHOUSE_PORT', clickhouse.secret, 'port')
    .withSecret('CLICKHOUSE_USERNAME', clickhouse.secret, 'username')
    .withSecret('CLICKHOUSE_PASSWORD', clickhouse.secret, 'password')
    .withSecret('CLICKHOUSE_PROTOCOL', clickhouse.secret, 'protocol')
    // Same secret as the graphql and schema services, so `organizations.slack_token`
    // written by the API decrypts here when dispatching metric-alert notifications.
    .withSecret('ENCRYPTION_SECRET', environment.encryptionSecret, 'encryptionPrivateKey')
    .deploy();

  egressManager
    ?.allowExternal(
      deployment,
      postgres.pgBouncerSecret.raw.host,
      postgres.pgBouncerSecret.raw.port,
    )
    .allowExternal(deployment, clickhouse.secret.raw.host, clickhouse.secret.raw.port)
    .allowExternal(deployment, 'https://api.postmarkapp.com')
    // Slack metric-alert notifications
    .allowExternal(deployment, 'https://slack.com')
    .allowExternal(deployment, heartbeat)
    .allowInCluster(deployment, redis.deployment)
    .allowInCluster(deployment, schema.deployment)
    // Calls user-provided URLs (webhooks).
    .allowAnyExternal(deployment)
    .allowExternal(deployment, sentry.secret?.raw.dsn)
    .allowInCluster(deployment, observability.observability?.otlpCollectorService);

  return { deployment, service };
}
