import * as pulumi from '@pulumi/pulumi';
import { serviceLocalEndpoint } from '../utils/local-endpoint';
import { ServiceSecret } from '../utils/secrets';
import { ServiceDeployment } from '../utils/service-deployment';
import type { Broker } from './cf-broker';
import { CDN } from './cf-cdn';
import { Clickhouse } from './clickhouse';
import { CommerceService } from './commerce';
import { DbMigrations } from './db-migrations';
import { Docker } from './docker';
import { Environment } from './environment';
import { GitHubApp } from './github';
import { Observability } from './observability';
import { SchemaPolicy } from './policy';
import { Postgres } from './postgres';
import { Redis } from './redis';
import { S3 } from './s3';
import { Schema } from './schema';
import { Sentry } from './sentry';
import { Usage } from './usage';
import { Zendesk } from './zendesk';

export type GraphQL = ReturnType<typeof deployGraphQL>;

class AppOAuthSecret extends ServiceSecret<{
  clientId: string | pulumi.Output<string>;
  clientSecret: string | pulumi.Output<string>;
}> {}

export function deployGraphQL({
  clickhouse,
  image,
  environment,
  schema,
  schemaPolicy,
  cdn,
  redis,
  usage,
  commerce,
  dbMigrations,
  s3,
  s3Mirror,
  s3AuditLog,
  zendesk,
  docker,
  postgres,
  githubApp,
  sentry,
  observability,
  broker,
}: {
  observability: Observability;
  githubApp: GitHubApp;
  postgres: Postgres;
  image: string;
  clickhouse: Clickhouse;
  environment: Environment;
  schema: Schema;
  schemaPolicy: SchemaPolicy;
  redis: Redis;
  cdn: CDN;
  s3: S3;
  s3Mirror: S3;
  s3AuditLog: S3;
  usage: Usage;
  dbMigrations: DbMigrations;
  commerce: CommerceService;
  zendesk: Zendesk;
  docker: Docker;
  sentry: Sentry;
  broker: Broker;
}) {
  const apiConfig = new pulumi.Config('api');
  const supertokensConfig = new pulumi.Config('supertokens');
  const apiEnv = apiConfig.requireObject<Record<string, string>>('env');

  const hiveConfig = new pulumi.Config('hive');

  const oauthConfig = new pulumi.Config('oauth');
  const githubOAuthSecret = new AppOAuthSecret('oauth-github', {
    clientId: oauthConfig.requireSecret('githubClient'),
    clientSecret: oauthConfig.requireSecret('githubSecret'),
  });
  const googleOAuthSecret = new AppOAuthSecret('oauth-google', {
    clientId: oauthConfig.requireSecret('googleClient'),
    clientSecret: oauthConfig.requireSecret('googleSecret'),
  });

  const persistedDocumentsSecret = new ServiceSecret('persisted-documents', {
    cdnAccessKeyId: apiConfig.requireSecret('hivePersistedDocumentsCdnAccessKeyId'),
  });
  const hiveUsageSecret = new ServiceSecret('hive-usage', {
    usageAccessToken: hiveConfig.requireSecret('usageAccessToken'),
  });
  const supertokensSecrets = new ServiceSecret('supertokens-at-home', {
    refreshTokenKey: supertokensConfig.requireSecret('refreshTokenKey'),
    accessTokenKey: supertokensConfig.requireSecret('accessTokenKey'),
    bypassRateLimitKey: supertokensConfig.requireSecret('bypassRateLimitKey'),
  });

  return (
    new ServiceDeployment(
      'graphql-api',
      {
        imagePullSecret: docker.secret,
        image,
        replicas: environment.podsConfig.graphqlApi.replicas,
        pdb: true,
        readinessProbe: '/_readiness',
        livenessProbe: {
          endpoint: '/_health',
          initialDelaySeconds: 10,
          timeoutSeconds: 5,
          periodSeconds: 30,
          failureThreshold: 10,
        },
        startupProbe: {
          endpoint: '/_health',
          initialDelaySeconds: 5,
          failureThreshold: 4,
          periodSeconds: 15,
          timeoutSeconds: 10,
        },
        availabilityOnEveryNode: true,
        env: {
          ...environment.envVars,
          ...apiEnv,
          LOG_LEVEL: 'info',
          SENTRY: sentry.enabled ? '1' : '0',
          REQUEST_LOGGING: '1',
          REQUEST_BROKER: '1',
          COMMERCE_ENDPOINT: serviceLocalEndpoint(commerce.service),
          SCHEMA_ENDPOINT: serviceLocalEndpoint(schema.service),
          SCHEMA_POLICY_ENDPOINT: serviceLocalEndpoint(schemaPolicy.service),
          WEB_APP_URL: `https://${environment.appDns}`,
          GRAPHQL_PUBLIC_ORIGIN: `https://${environment.appDns}`,
          CDN_CF: '1',
          HIVE_USAGE: '1',
          HIVE_TARGET: hiveConfig.require('target'),
          HIVE_USAGE_ENDPOINT: serviceLocalEndpoint(usage.service),
          HIVE_FIELD_USAGE_ENABLED: '1',
          HIVE_TRACING: '1',
          HIVE_TRACING_ENDPOINT: environment.isProduction
            ? 'https://api.graphql-hive.com/otel/v1/traces'
            : environment.isStaging
              ? 'https://api.hiveready.dev/otel/v1/traces'
              : 'https://api.buzzcheck.dev/otel/v1/traces',
          HIVE_PERSISTED_DOCUMENTS: '1',
          ZENDESK_SUPPORT: zendesk.enabled ? '1' : '0',
          ...(zendesk.enabled ? { ZENDESK_BASE_URL: 'https://theguild.zendesk.com' } : {}),
          INTEGRATION_GITHUB: '1',
          // Auth
          AUTH_GITHUB: '1',
          AUTH_GOOGLE: '1',
          AUTH_ORGANIZATION_OIDC: '1',
          AUTH_ORGANIZATION_SCIM: '1',
          AUTH_REQUIRE_EMAIL_VERIFICATION: '1',
          // Traces (OTLP)
          OPENTELEMETRY_COLLECTOR_ENDPOINT:
            observability.enabled && observability.tracingEndpoint
              ? observability.tracingEndpoint
              : '',
          S3_MIRROR: '1',
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
        commerce.deployment,
        commerce.service,
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
      .withSecret('POSTGRES_HOST', postgres.pgBouncerSecret, 'host')
      .withSecret('POSTGRES_PORT', postgres.pgBouncerSecret, 'port')
      .withSecret('POSTGRES_USER', postgres.pgBouncerSecret, 'user')
      .withSecret('POSTGRES_PASSWORD', postgres.pgBouncerSecret, 'password')
      .withSecret('POSTGRES_DB', postgres.pgBouncerSecret, 'database')
      .withSecret('POSTGRES_SSL', postgres.pgBouncerSecret, 'ssl')
      // CDN
      .withSecret('CDN_AUTH_PRIVATE_KEY', cdn.secret, 'authPrivateKey')
      .withSecret('CDN_CF_BASE_URL', cdn.secret, 'baseUrl')
      // S3
      .withSecret('S3_ACCESS_KEY_ID', s3.secret, 'accessKeyId')
      .withSecret('S3_SECRET_ACCESS_KEY', s3.secret, 'secretAccessKey')
      .withSecret('S3_BUCKET_NAME', s3.secret, 'bucket')
      .withSecret('S3_ENDPOINT', s3.secret, 'endpoint')
      // S3 Mirror
      .withSecret('S3_MIRROR_ACCESS_KEY_ID', s3Mirror.secret, 'accessKeyId')
      .withSecret('S3_MIRROR_SECRET_ACCESS_KEY', s3Mirror.secret, 'secretAccessKey')
      .withSecret('S3_MIRROR_BUCKET_NAME', s3Mirror.secret, 'bucket')
      .withSecret('S3_MIRROR_ENDPOINT', s3Mirror.secret, 'endpoint')
      // S3 Audit Log
      .withSecret('S3_AUDIT_LOG_ACCESS_KEY_ID', s3AuditLog.secret, 'accessKeyId')
      .withSecret('S3_AUDIT_LOG_SECRET_ACCESS_KEY', s3AuditLog.secret, 'secretAccessKey')
      .withSecret('S3_AUDIT_LOG_BUCKET_NAME', s3AuditLog.secret, 'bucket')
      .withSecret('S3_AUDIT_LOG_ENDPOINT', s3AuditLog.secret, 'endpoint')
      // Auth
      .withSecret('AUTH_GITHUB_CLIENT_ID', githubOAuthSecret, 'clientId')
      .withSecret('AUTH_GITHUB_CLIENT_SECRET', githubOAuthSecret, 'clientSecret')
      .withSecret('AUTH_GOOGLE_CLIENT_ID', googleOAuthSecret, 'clientId')
      .withSecret('AUTH_GOOGLE_CLIENT_SECRET', googleOAuthSecret, 'clientSecret')
      .withSecret('REQUEST_BROKER_ENDPOINT', broker.secret, 'baseUrl')
      .withSecret('REQUEST_BROKER_SIGNATURE', broker.secret, 'secretSignature')
      // Hive Usage Reporting
      .withSecret('HIVE_ACCESS_TOKEN', hiveUsageSecret, 'usageAccessToken')
      // Persisted Documents
      .withSecret(
        'HIVE_PERSISTED_DOCUMENTS_CDN_ACCESS_KEY_ID',
        persistedDocumentsSecret,
        'cdnAccessKeyId',
      )
      // Supertokens
      .withSecret('SUPERTOKENS_REFRESH_TOKEN_KEY', supertokensSecrets, 'refreshTokenKey')
      .withSecret('SUPERTOKENS_ACCESS_TOKEN_KEY', supertokensSecrets, 'accessTokenKey')
      .withSecret('SUPERTOKENS_RATE_LIMIT_BYPASS_KEY', supertokensSecrets, 'bypassRateLimitKey')
      // Zendesk
      .withConditionalSecret(zendesk.enabled, 'ZENDESK_USERNAME', zendesk.secret, 'username')
      .withConditionalSecret(zendesk.enabled, 'ZENDESK_PASSWORD', zendesk.secret, 'password')
      // Sentry
      .withConditionalSecret(sentry.enabled, 'SENTRY_DSN', sentry.secret, 'dsn')
      // Other
      .withSecret('ENCRYPTION_SECRET', environment.encryptionSecret, 'encryptionPrivateKey')
      .deploy()
  );
}
