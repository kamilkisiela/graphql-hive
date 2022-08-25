import { createApplication, Scope } from 'graphql-modules';
import { activityModule } from './modules/activity';
import { authModule } from './modules/auth';
import { labModule } from './modules/lab';
import { operationsModule } from './modules/operations';
import { ClickHouseConfig, CLICKHOUSE_CONFIG } from './modules/operations/providers/tokens';
import { organizationModule } from './modules/organization';
import { persistedOperationModule } from './modules/persisted-operations';
import { projectModule } from './modules/project';
import { schemaModule } from './modules/schema';
import { sharedModule } from './modules/shared';
import { HttpClient } from './modules/shared/providers/http-client';
import { IdTranslator } from './modules/shared/providers/id-translator';
import { IdempotentRunner } from './modules/shared/providers/idempotent-runner';
import { Logger } from './modules/shared/providers/logger';
import { MessageBus } from './modules/shared/providers/message-bus';
import { CryptoProvider, encryptionSecretProvider } from './modules/shared/providers/crypto';
import { RedisConfig, REDIS_CONFIG, RedisProvider } from './modules/shared/providers/redis';
import { Storage } from './modules/shared/providers/storage';
import { EMAILS_ENDPOINT, Emails } from './modules/shared/providers/emails';
import { Tracking } from './modules/shared/providers/tracking';
import { targetModule } from './modules/target';
import { integrationsModule } from './modules/integrations';
import {
  GITHUB_APP_CONFIG,
  GitHubApplicationConfig,
} from './modules/integrations/providers/github-integration-manager';
import { alertsModule } from './modules/alerts';
import { tokenModule } from './modules/token';
import { feedbackModule } from './modules/feedback';
import { TokensConfig, TOKENS_CONFIG } from './modules/token/providers/tokens';
import { WebhooksConfig, WEBHOOKS_CONFIG } from './modules/alerts/providers/tokens';
import { SchemaServiceConfig, SCHEMA_SERVICE_CONFIG } from './modules/schema/providers/orchestrators/tokens';
import { provideSchemaModuleConfig, SchemaModuleConfig } from './modules/schema/providers/config';
import { CDN_CONFIG, CDNConfig } from './modules/cdn/providers/tokens';
import { cdnModule } from './modules/cdn';
import { adminModule } from './modules/admin';
import { FEEDBACK_SLACK_CHANNEL, FEEDBACK_SLACK_TOKEN } from './modules/feedback/providers/tokens';
import { usageEstimationModule } from './modules/usage-estimation';
import {
  UsageEstimationServiceConfig,
  USAGE_ESTIMATION_SERVICE_CONFIG,
} from './modules/usage-estimation/providers/tokens';
import { rateLimitModule } from './modules/rate-limit';
import { RateLimitServiceConfig, RATE_LIMIT_SERVICE_CONFIG } from './modules/rate-limit/providers/tokens';
import { BillingConfig, BILLING_CONFIG } from './modules/billing/providers/tokens';
import { billingModule } from './modules/billing';

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
];

export function createRegistry({
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
  encryptionSecret,
  feedback,
  billing,
  schemaConfig,
  emailsEndpoint,
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
  githubApp: GitHubApplicationConfig;
  cdn: CDNConfig;
  encryptionSecret: string;
  feedback: {
    token: string;
    channel: string;
  };
  billing: BillingConfig;
  schemaConfig: SchemaModuleConfig;
  emailsEndpoint?: string;
}) {
  const providers = [
    HttpClient,
    IdTranslator,
    MessageBus,
    Tracking,
    RedisProvider,
    IdempotentRunner,
    CryptoProvider,
    Emails,
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
      provide: FEEDBACK_SLACK_CHANNEL,
      useValue: feedback.channel,
      scope: Scope.Singleton,
    },
    {
      provide: FEEDBACK_SLACK_TOKEN,
      useValue: feedback.token,
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
