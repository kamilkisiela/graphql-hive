import * as pulumi from '@pulumi/pulumi';
import { Output } from '@pulumi/pulumi';
import { ServiceSecret } from '../secrets';
import { DeploymentEnvironment } from '../types';
import { isProduction } from '../utils/helpers';
import { serviceLocalEndpoint } from '../utils/local-endpoint';
import { ServiceDeployment } from '../utils/service-deployment';
import { StripeBillingService } from './billing';
import { CDN } from './cf-cdn';
import { Clickhouse } from './clickhouse';
import { Common } from './common';
import { DbMigrations } from './db-migrations';
import { Docker } from './docker';
import { Emails } from './emails';
import { GitHubApp } from './github';
import { SchemaPolicy } from './policy';
import { Postgres } from './postgres';
import { RateLimitService } from './rate-limit';
import { Redis } from './redis';
import { S3 } from './s3';
import { Schema } from './schema';
import { Supertokens } from './supertokens';
import { Tokens } from './tokens';
import { Usage } from './usage';
import { UsageEstimator } from './usage-estimation';
import { Webhooks } from './webhooks';
import { Zendesk } from './zendesk';

export type GraphQL = ReturnType<typeof deployGraphQL>;

export function deployGraphQL({
  clickhouse,
  release,
  image,
  deploymentEnv,
  tokens,
  webhooks,
  schema,
  schemaPolicy,
  cdn,
  redis,
  usage,
  usageEstimator,
  dbMigrations,
  rateLimit,
  billing,
  emails,
  supertokens,
  s3,
  zendesk,
  docker,
  postgres,
  common,
  githubApp,
}: {
  githubApp: GitHubApp;
  common: Common;
  postgres: Postgres;
  release: string;
  image: string;
  clickhouse: Clickhouse;
  deploymentEnv: DeploymentEnvironment;
  tokens: Tokens;
  webhooks: Webhooks;
  schema: Schema;
  schemaPolicy: SchemaPolicy;
  redis: Redis;
  cdn: CDN;
  s3: S3;
  usage: Usage;
  usageEstimator: UsageEstimator;
  dbMigrations: DbMigrations;
  rateLimit: RateLimitService;
  billing: StripeBillingService;
  emails: Emails;
  supertokens: Supertokens;
  zendesk: Zendesk;
  docker: Docker;
}) {
  const commonConfig = new pulumi.Config('common');
  const apiConfig = new pulumi.Config('api');

  const commonEnv = commonConfig.requireObject<Record<string, string>>('env');
  const apiEnv = apiConfig.requireObject<Record<string, string>>('env');

  let deployment = new ServiceDeployment(
    'graphql-api',
    {
      imagePullSecret: docker.secret,
      image,
      replicas: isProduction(deploymentEnv) ? 3 : 1,
      pdb: true,
      readinessProbe: '/_readiness',
      livenessProbe: '/_health',
      startupProbe: {
        endpoint: '/_health',
        initialDelaySeconds: 60,
        failureThreshold: 10,
        periodSeconds: 15,
        timeoutSeconds: 15,
      },
      availabilityOnEveryNode: true,
      env: {
        ...apiEnv,
        ...deploymentEnv,
        ...apiConfig.requireObject<Record<string, string>>('env'),
        ...commonEnv,
        RELEASE: release,
        SENTRY: commonEnv.SENTRY_ENABLED,
        REQUEST_LOGGING: '0', // disabled
        BILLING_ENDPOINT: serviceLocalEndpoint(billing.service),
        TOKENS_ENDPOINT: serviceLocalEndpoint(tokens.service),
        WEBHOOKS_ENDPOINT: serviceLocalEndpoint(webhooks.service),
        SCHEMA_ENDPOINT: serviceLocalEndpoint(schema.service),
        SCHEMA_POLICY_ENDPOINT: serviceLocalEndpoint(schemaPolicy.service),
        HIVE_USAGE_ENDPOINT: serviceLocalEndpoint(usage.service),
        RATE_LIMIT_ENDPOINT: serviceLocalEndpoint(rateLimit.service),
        EMAILS_ENDPOINT: serviceLocalEndpoint(emails.service),
        USAGE_ESTIMATOR_ENDPOINT: serviceLocalEndpoint(usageEstimator.service),
        WEB_APP_URL: `https://${deploymentEnv.DEPLOYED_DNS}`,
        CDN_CF: '1',
        HIVE: '1',
        HIVE_REPORTING: '1',
        HIVE_USAGE: '1',
        HIVE_REPORTING_ENDPOINT: 'http://0.0.0.0:4000/graphql',
        ZENDESK_SUPPORT: zendesk.enabled ? '1' : '0',
        INTEGRATION_GITHUB: '1',
        SUPERTOKENS_CONNECTION_URI: supertokens.localEndpoint,
        AUTH_ORGANIZATION_OIDC: '1',
        GRAPHQL_PERSISTED_OPERATIONS_PATH: './persisted-operations.json',
      },
      exposesMetrics: true,
      port: 4000,
    },
    [
      dbMigrations,
      redis.deployment,
      redis.service,
      clickhouse.deployment,
      clickhouse.service,
      rateLimit.deployment,
      rateLimit.service,
    ],
  )
    // GitHub App
    .withSecret('INTEGRATION_GITHUB_APP_ID', githubApp.secret, 'appId')
    .withSecret('INTEGRATION_GITHUB_APP_PRIVATE_KEY', githubApp.secret, 'privateKey')
    // Clickhouse
    .withSecret('CLICKHOUSE_HOST', clickhouse.secret, 'host')
    .withSecret('CLICKHOUSE_PORT', clickhouse.secret, 'port')
    .withSecret('CLICKHOUSE_USERNAME', clickhouse.secret, 'username')
    .withSecret('CLICKHOUSE_PASSWORD', clickhouse.secret, 'password')
    .withSecret('CLICKHOUSE_PROTOCOL', clickhouse.secret, 'protocol')
    // Redis
    .withSecret('REDIS_HOST', redis.secret, 'host')
    .withSecret('REDIS_PORT', redis.secret, 'port')
    .withSecret('REDIS_PASSWORD', redis.secret, 'password')
    // PG
    .withSecret('POSTGRES_HOST', postgres.secret, 'host')
    .withSecret('POSTGRES_PORT', postgres.secret, 'port')
    .withSecret('POSTGRES_USER', postgres.secret, 'user')
    .withSecret('POSTGRES_PASSWORD', postgres.secret, 'password')
    .withSecret('POSTGRES_DB', postgres.secret, 'database')
    .withSecret('POSTGRES_SSL', postgres.secret, 'ssl')
    // CDN
    .withSecret('CDN_AUTH_PRIVATE_KEY', cdn.secret, 'authPrivateKey')
    .withSecret('CDN_CF_BASE_URL', cdn.secret, 'baseUrl')
    // S3
    .withSecret('S3_ACCESS_KEY_ID', s3.secret, 'accessKeyId')
    .withSecret('S3_SECRET_ACCESS_KEY', s3.secret, 'secretAccessKey')
    .withSecret('S3_BUCKET_NAME', s3.secret, 'bucket')
    .withSecret('S3_ENDPOINT', s3.secret, 'endpoint')
    // Supertokens
    .withSecret('SUPERTOKENS_API_KEY', supertokens.secret, 'apiKey')
    // Other
    .withSecret('ENCRYPTION_SECRET', common.encryptionSecret, 'encryptionPrivateKey');

  if (zendesk.enabled && zendesk.secret) {
    deployment = deployment
      .withSecret('ZENDESK_USERNAME', zendesk.secret, 'username')
      .withSecret('ZENDESK_PASSWORD', zendesk.secret, 'password')
      .withSecret('ZENDESK_SUBDOMAIN', zendesk.secret, 'subdomain');
  }

  return deployment.deploy();
}
