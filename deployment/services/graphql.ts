import * as pulumi from '@pulumi/pulumi';
import * as azure from '@pulumi/azure';
import { Cloudflare } from './cloudflare';
import { parse } from 'pg-connection-string';
import { Tokens } from './tokens';
import { Webhooks } from './webhooks';
import { Redis } from './redis';
import { DbMigrations } from './db-migrations';
import { Schema } from './schema';
import { RemoteArtifactAsServiceDeployment } from '../utils/remote-artifact-as-service';
import { serviceLocalEndpoint } from '../utils/local-endpoint';
import { DeploymentEnvironment } from '../types';
import { Clickhouse } from './clickhouse';
import { Usage } from './usage';
import { PackageHelper } from '../utils/pack';
import { UsageEstimator } from './usage-estimation';
import { RateLimitService } from './rate-limit';
import { Emails } from './emails';
import { StripeBillingService } from './billing';
import { Output } from '@pulumi/pulumi';

const commonConfig = new pulumi.Config('common');
const cloudflareConfig = new pulumi.Config('cloudflare');
const apiConfig = new pulumi.Config('api');
const githubAppConfig = new pulumi.Config('ghapp');

const commonEnv = commonConfig.requireObject<Record<string, string>>('env');
const apiEnv = apiConfig.requireObject<Record<string, string>>('env');

export type GraphQL = ReturnType<typeof deployGraphQL>;

export function deployGraphQL({
  clickhouse,
  packageHelper,
  storageContainer,
  deploymentEnv,
  tokens,
  webhooks,
  schema,
  cloudflare,
  redis,
  usage,
  usageEstimator,
  dbMigrations,
  rateLimit,
  billing,
  emails,
  supertokensConfig,
  auth0Config,
}: {
  storageContainer: azure.storage.Container;
  packageHelper: PackageHelper;
  clickhouse: Clickhouse;
  deploymentEnv: DeploymentEnvironment;
  tokens: Tokens;
  webhooks: Webhooks;
  schema: Schema;
  redis: Redis;
  cloudflare: Cloudflare;
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
}) {
  const rawConnectionString = apiConfig.requireSecret('postgresConnectionString');
  const connectionString = rawConnectionString.apply(rawConnectionString => parse(rawConnectionString));

  return new RemoteArtifactAsServiceDeployment(
    'graphql-api',
    {
      storageContainer,
      replicas: 2,
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
        RELEASE: packageHelper.currentReleaseId(),
        POSTGRES_HOST: connectionString.apply(connection => connection.host ?? ''),
        POSTGRES_PORT: connectionString.apply(connection => connection.port ?? '5432'),
        POSTGRES_PASSWORD: connectionString.apply(connection => connection.password ?? ''),
        POSTGRES_USER: connectionString.apply(connection => connection.user ?? ''),
        POSTGRES_DB: connectionString.apply(connection => connection.database ?? ''),
        POSTGRES_SSL: connectionString.apply(connection => (connection.ssl ? '1' : '0')),
        BILLING_ENDPOINT: serviceLocalEndpoint(billing.service),
        TOKENS_ENDPOINT: serviceLocalEndpoint(tokens.service),
        WEBHOOKS_ENDPOINT: serviceLocalEndpoint(webhooks.service),
        SCHEMA_ENDPOINT: serviceLocalEndpoint(schema.service),
        // CDN
        CDN: '1',
        CDN_CF_BASE_PATH: 'https://api.cloudflare.com/client/v4/accounts',
        CDN_CF_ACCOUNT_ID: cloudflareConfig.require('accountId'),
        CDN_CF_AUTH_TOKEN: cloudflareConfig.requireSecret('apiToken'),
        CDN_CF_NAMESPACE_ID: cloudflare.cfStorageNamespaceId,
        CDN_BASE_URL: cloudflare.workerBaseUrl,
        CDN_AUTH_PRIVATE_KEY: cloudflare.authPrivateKey,
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
      packageInfo: packageHelper.npmPack('@hive/server'),
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
    ]
  ).deploy();
}
