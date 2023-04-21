import { createApplication, Scope } from 'graphql-modules';
import { AwsClient } from '@hive/cdn-script/aws';
import { activityModule } from './modules/activity';
import { adminModule } from './modules/admin';
import { alertsModule } from './modules/alerts';
import { WEBHOOKS_CONFIG, WebhooksConfig } from './modules/alerts/providers/tokens';
import { authModule } from './modules/auth';
import { billingModule } from './modules/billing';
import { BILLING_CONFIG, BillingConfig } from './modules/billing/providers/tokens';
import { cdnModule } from './modules/cdn';
import { CDN_CONFIG, CDNConfig } from './modules/cdn/providers/tokens';
import { feedbackModule } from './modules/feedback';
import { FEEDBACK_SLACK_CHANNEL, FEEDBACK_SLACK_TOKEN } from './modules/feedback/providers/tokens';
import { integrationsModule } from './modules/integrations';
import {
  GITHUB_APP_CONFIG,
  GitHubApplicationConfig,
} from './modules/integrations/providers/github-integration-manager';
import { labModule } from './modules/lab';
import { oidcIntegrationsModule } from './modules/oidc-integrations';
import { OIDC_INTEGRATIONS_ENABLED } from './modules/oidc-integrations/providers/tokens';
import { operationsModule } from './modules/operations';
import { CLICKHOUSE_CONFIG, ClickHouseConfig } from './modules/operations/providers/tokens';
import { organizationModule } from './modules/organization';
import { persistedOperationModule } from './modules/persisted-operations';
import { projectModule } from './modules/project';
import { rateLimitModule } from './modules/rate-limit';
import {
  RATE_LIMIT_SERVICE_CONFIG,
  RateLimitServiceConfig,
} from './modules/rate-limit/providers/tokens';
import { schemaModule } from './modules/schema';
import { ArtifactStorageWriter } from './modules/schema/providers/artifact-storage-writer';
import { provideSchemaModuleConfig, SchemaModuleConfig } from './modules/schema/providers/config';
import {
  SCHEMA_SERVICE_CONFIG,
  SchemaServiceConfig,
} from './modules/schema/providers/orchestrators/tokens';
import { sharedModule } from './modules/shared';
import { CryptoProvider, encryptionSecretProvider } from './modules/shared/providers/crypto';
import { DistributedCache } from './modules/shared/providers/distributed-cache';
import { Emails, EMAILS_ENDPOINT } from './modules/shared/providers/emails';
import { HttpClient } from './modules/shared/providers/http-client';
import { IdTranslator } from './modules/shared/providers/id-translator';
import { Logger } from './modules/shared/providers/logger';
import { Mutex } from './modules/shared/providers/mutex';
import { REDIS_CONFIG, RedisConfig, RedisProvider } from './modules/shared/providers/redis';
import { S3_CONFIG, type S3Config } from './modules/shared/providers/s3-config';
import { Storage } from './modules/shared/providers/storage';
import { WEB_APP_URL } from './modules/shared/providers/tokens';
import { targetModule } from './modules/target';
import { tokenModule } from './modules/token';
import { TOKENS_CONFIG, TokensConfig } from './modules/token/providers/tokens';
import { usageEstimationModule } from './modules/usage-estimation';
import {
  USAGE_ESTIMATION_SERVICE_CONFIG,
  UsageEstimationServiceConfig,
} from './modules/usage-estimation/providers/tokens';

const modules = [
  sharedModule,
  authModule,
  organizationModule,
  projectModule,
  targetModule,
  schemaModule,
  activityModule,
  operationsModule,
  tokenModule,
  persistedOperationModule,
  labModule,
  integrationsModule,
  alertsModule,
  feedbackModule,
  cdnModule,
  adminModule,
  usageEstimationModule,
  rateLimitModule,
  billingModule,
  oidcIntegrationsModule,
];

export function createRegistry({
  app,
  tokens,
  webhooks,
  schemaService,
  usageEstimationService,
  rateLimitService,
  logger,
  storage,
  clickHouse,
  redis,
  githubApp,
  cdn,
  s3,
  encryptionSecret,
  feedback,
  billing,
  schemaConfig,
  emailsEndpoint,
  organizationOIDC,
}: {
  logger: Logger;
  storage: Storage;
  clickHouse: ClickHouseConfig;
  redis: RedisConfig;
  tokens: TokensConfig;
  webhooks: WebhooksConfig;
  schemaService: SchemaServiceConfig;
  usageEstimationService: UsageEstimationServiceConfig;
  rateLimitService: RateLimitServiceConfig;
  githubApp: GitHubApplicationConfig | null;
  cdn: CDNConfig | null;
  s3: {
    bucketName: string;
    endpoint: string;
    accessKeyId: string;
    secretAccessKeyId: string;
  };
  encryptionSecret: string;
  feedback: {
    token: string;
    channel: string;
  };
  app: {
    baseUrl: string;
  } | null;
  billing: BillingConfig;
  schemaConfig: SchemaModuleConfig;
  emailsEndpoint?: string;
  organizationOIDC: boolean;
}) {
  const s3Config: S3Config = {
    client: new AwsClient({
      accessKeyId: s3.accessKeyId,
      secretAccessKey: s3.secretAccessKeyId,
      service: 's3',
      region: 'auto',
    }),
    bucket: s3.bucketName,
    endpoint: s3.endpoint,
  };

  const artifactStorageWriter = new ArtifactStorageWriter(s3Config);

  const providers = [
    HttpClient,
    IdTranslator,
    RedisProvider,
    Mutex,
    DistributedCache,
    CryptoProvider,
    Emails,
    {
      provide: ArtifactStorageWriter,
      useValue: artifactStorageWriter,
    },
    {
      provide: Logger,
      useValue: logger,
      scope: Scope.Singleton,
    },
    {
      provide: Storage,
      useValue: storage,
      scope: Scope.Singleton,
    },
    {
      provide: CLICKHOUSE_CONFIG,
      useValue: clickHouse,
      scope: Scope.Singleton,
    },
    {
      provide: TOKENS_CONFIG,
      useValue: tokens,
      scope: Scope.Singleton,
    },
    {
      provide: BILLING_CONFIG,
      useValue: billing,
      scope: Scope.Singleton,
    },
    {
      provide: WEBHOOKS_CONFIG,
      useValue: webhooks,
      scope: Scope.Singleton,
    },
    {
      provide: SCHEMA_SERVICE_CONFIG,
      useValue: schemaService,
      scope: Scope.Singleton,
    },
    {
      provide: USAGE_ESTIMATION_SERVICE_CONFIG,
      useValue: usageEstimationService,
      scope: Scope.Singleton,
    },
    {
      provide: RATE_LIMIT_SERVICE_CONFIG,
      useValue: rateLimitService,
      scope: Scope.Singleton,
    },
    {
      provide: REDIS_CONFIG,
      useValue: redis,
      scope: Scope.Singleton,
    },
    {
      provide: GITHUB_APP_CONFIG,
      useValue: githubApp,
      scope: Scope.Singleton,
    },
    {
      provide: CDN_CONFIG,
      useValue: cdn,
      scope: Scope.Singleton,
    },
    {
      provide: S3_CONFIG,
      useValue: s3Config,
      scope: Scope.Singleton,
    },
    {
      provide: FEEDBACK_SLACK_CHANNEL,
      useValue: feedback.channel,
      scope: Scope.Singleton,
    },
    {
      provide: FEEDBACK_SLACK_TOKEN,
      useValue: feedback.token,
      scope: Scope.Singleton,
    },
    {
      provide: OIDC_INTEGRATIONS_ENABLED,
      useValue: organizationOIDC,
      scope: Scope.Singleton,
    },
    {
      provide: WEB_APP_URL,
      useValue: app?.baseUrl.replace(/\/$/, '') ?? 'http://localhost:3000',
      scope: Scope.Singleton,
    },
    encryptionSecretProvider(encryptionSecret),
    provideSchemaModuleConfig(schemaConfig),
  ];

  if (emailsEndpoint) {
    providers.push({
      provide: EMAILS_ENDPOINT,
      useValue: emailsEndpoint,
      scope: Scope.Singleton,
    });
  }

  return createApplication({
    modules,
    providers,
  });
}
