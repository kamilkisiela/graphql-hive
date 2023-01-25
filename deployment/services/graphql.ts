import * as k8s from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import { Output } from '@pulumi/pulumi';
import { parse } from 'pg-connection-string';
import { DeploymentEnvironment } from '../types';
import { isProduction } from '../utils/helpers';
import { serviceLocalEndpoint } from '../utils/local-endpoint';
import { ServiceDeployment } from '../utils/service-deployment';
import { StripeBillingService } from './billing';
import { CDN } from './cf-cdn';
import { Clickhouse } from './clickhouse';
import { DbMigrations } from './db-migrations';
import { Emails } from './emails';
import { RateLimitService } from './rate-limit';
import { Redis } from './redis';
import { Schema } from './schema';
import { Tokens } from './tokens';
import { Usage } from './usage';
import { UsageEstimator } from './usage-estimation';
import { Webhooks } from './webhooks';

const commonConfig = new pulumi.Config('common');
const cloudflareConfig = new pulumi.Config('cloudflare');
const apiConfig = new pulumi.Config('api');
const githubAppConfig = new pulumi.Config('ghapp');

const commonEnv = commonConfig.requireObject<Record<string, string>>('env');
const apiEnv = apiConfig.requireObject<Record<string, string>>('env');

export type GraphQL = ReturnType<typeof deployGraphQL>;

export function deployGraphQL({
  clickhouse,
  release,
  image,
  deploymentEnv,
  tokens,
  webhooks,
  schema,
  cdn,
  redis,
  usage,
  usageEstimator,
  dbMigrations,
  rateLimit,
  billing,
  emails,
  supertokensConfig,
  auth0Config,
  s3Config,
  imagePullSecret,
}: {
  release: string;
  image: string;
  clickhouse: Clickhouse;
  deploymentEnv: DeploymentEnvironment;
  tokens: Tokens;
  webhooks: Webhooks;
  schema: Schema;
  redis: Redis;
  cdn: CDN;
  usage: Usage;
  usageEstimator: UsageEstimator;
  dbMigrations: DbMigrations;
  rateLimit: RateLimitService;
  billing: StripeBillingService;
  emails: Emails;
  supertokensConfig: {
    endpoint: Output<string>;
    apiKey: Output<string>;
  };
  auth0Config: {
    internalApiKey: Output<string>;
  };
  s3Config: {
    endpoint: string;
    bucketName: string;
    accessKeyId: Output<string>;
    secretAccessKey: Output<string>;
  };
  imagePullSecret: k8s.core.v1.Secret;
}) {
  const rawConnectionString = apiConfig.requireSecret('postgresConnectionString');
  const connectionString = rawConnectionString.apply(rawConnectionString =>
    parse(rawConnectionString),
  );

  return new ServiceDeployment(
    'graphql-api',
    {
      imagePullSecret,
      image,
      replicas: isProduction(deploymentEnv) ? 2 : 1,
      pdb: true,
      readinessProbe: '/_readiness',
      livenessProbe: '/_health',
      env: {
        ...apiEnv,
        ...deploymentEnv,
        ...apiConfig.requireObject<Record<string, string>>('env'),
        ...commonEnv,
        SENTRY: commonEnv.SENTRY_ENABLED,
        CLICKHOUSE_PROTOCOL: clickhouse.config.protocol,
        CLICKHOUSE_HOST: clickhouse.config.host,
        CLICKHOUSE_PORT: clickhouse.config.port,
        CLICKHOUSE_USERNAME: clickhouse.config.username,
        CLICKHOUSE_PASSWORD: clickhouse.config.password,
        REDIS_HOST: redis.config.host,
        REDIS_PORT: String(redis.config.port),
        REDIS_PASSWORD: redis.config.password,
        RELEASE: release,
        POSTGRES_HOST: connectionString.apply(connection => connection.host ?? ''),
        POSTGRES_PORT: connectionString.apply(connection => connection.port ?? '5432'),
        POSTGRES_PASSWORD: connectionString.apply(connection => connection.password ?? ''),
        POSTGRES_USER: connectionString.apply(connection => connection.user ?? ''),
        POSTGRES_DB: connectionString.apply(connection => connection.database ?? ''),
        POSTGRES_SSL: connectionString.apply(connection => (connection.ssl ? '1' : '0')),
        S3_ENDPOINT: s3Config.endpoint,
        S3_ACCESS_KEY_ID: s3Config.accessKeyId,
        S3_SECRET_ACCESS_KEY: s3Config.secretAccessKey,
        S3_BUCKET_NAME: s3Config.bucketName,
        BILLING_ENDPOINT: serviceLocalEndpoint(billing.service),
        TOKENS_ENDPOINT: serviceLocalEndpoint(tokens.service),
        WEBHOOKS_ENDPOINT: serviceLocalEndpoint(webhooks.service),
        SCHEMA_ENDPOINT: serviceLocalEndpoint(schema.service),
        WEB_APP_URL: `https://${deploymentEnv.DEPLOYED_DNS}/`,
        // CDN
        CDN_CF: '1',
        CDN_CF_BASE_PATH: 'https://api.cloudflare.com/client/v4/accounts',
        CDN_CF_ACCOUNT_ID: cloudflareConfig.require('accountId'),
        CDN_CF_AUTH_TOKEN: cloudflareConfig.requireSecret('apiToken'),
        CDN_CF_NAMESPACE_ID: cdn.cfStorageNamespaceId,
        CDN_CF_BASE_URL: cdn.workerBaseUrl,
        CDN_AUTH_PRIVATE_KEY: cdn.authPrivateKey,
        // Hive
        HIVE: '1',
        HIVE_REPORTING: '1',
        HIVE_USAGE: '1',
        HIVE_USAGE_ENDPOINT: serviceLocalEndpoint(usage.service),
        HIVE_REPORTING_ENDPOINT: 'http://0.0.0.0:4000/graphql',
        //
        USAGE_ESTIMATOR_ENDPOINT: serviceLocalEndpoint(usageEstimator.service),
        INTEGRATION_GITHUB: '1',
        INTEGRATION_GITHUB_APP_ID: githubAppConfig.require('id'),
        INTEGRATION_GITHUB_APP_PRIVATE_KEY: githubAppConfig.requireSecret('key'),
        RATE_LIMIT_ENDPOINT: serviceLocalEndpoint(rateLimit.service),
        EMAILS_ENDPOINT: serviceLocalEndpoint(emails.service),
        ENCRYPTION_SECRET: commonConfig.requireSecret('encryptionSecret'),
        // Auth
        SUPERTOKENS_CONNECTION_URI: supertokensConfig.endpoint,
        SUPERTOKENS_API_KEY: supertokensConfig.apiKey,
        AUTH_LEGACY_AUTH0: '1',
        AUTH_LEGACY_AUTH0_INTERNAL_API_KEY: auth0Config.internalApiKey,
        AUTH_ORGANIZATION_OIDC: '1',
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
  ).deploy();
}
