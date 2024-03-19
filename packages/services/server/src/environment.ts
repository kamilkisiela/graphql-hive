import zod from 'zod';

const isNumberString = (input: unknown) => zod.string().regex(/^\d+$/).safeParse(input).success;

const numberFromNumberOrNumberString = (input: unknown): number | undefined => {
  if (typeof input == 'number') return input;
  if (isNumberString(input)) return Number(input);
};

const NumberFromString = zod.preprocess(numberFromNumberOrNumberString, zod.number().min(1));

// treat an empty string (`''`) as undefined
const emptyString = <T extends zod.ZodType>(input: T) => {
  return zod.preprocess((value: unknown) => {
    if (value === '') return undefined;
    return value;
  }, input);
};

const EnvironmentModel = zod.object({
  PORT: emptyString(NumberFromString.optional()),
  ENVIRONMENT: emptyString(zod.string().optional()),
  RELEASE: emptyString(zod.string().optional()),
  ENCRYPTION_SECRET: emptyString(zod.string()),
  WEB_APP_URL: zod.string().url(),
  GRAPHQL_PUBLIC_ORIGIN: zod.string().url(),
  RATE_LIMIT_ENDPOINT: emptyString(zod.string().url().optional()),
  SCHEMA_POLICY_ENDPOINT: emptyString(zod.string().url().optional()),
  TOKENS_ENDPOINT: zod.string().url(),
  USAGE_ESTIMATOR_ENDPOINT: emptyString(zod.string().url().optional()),
  USAGE_ESTIMATOR_RETENTION_PURGE_INTERVAL_MINUTES: emptyString(NumberFromString.optional()),
  BILLING_ENDPOINT: emptyString(zod.string().url().optional()),
  EMAILS_ENDPOINT: emptyString(zod.string().url().optional()),
  WEBHOOKS_ENDPOINT: zod.string().url(),
  SCHEMA_ENDPOINT: zod.string().url(),
  AUTH_ORGANIZATION_OIDC: emptyString(zod.union([zod.literal('1'), zod.literal('0')]).optional()),
  GRAPHQL_PERSISTED_OPERATIONS_PATH: emptyString(zod.string().optional()),
  AUTH_REQUIRE_EMAIL_VERIFICATION: emptyString(
    zod.union([zod.literal('1'), zod.literal('0')]).optional(),
  ),
});

const SentryModel = zod.union([
  zod.object({
    SENTRY: emptyString(zod.literal('0').optional()),
  }),
  zod.object({
    SENTRY: zod.literal('1'),
    SENTRY_DSN: zod.string(),
  }),
]);

const ZendeskSupportModel = zod.union([
  zod.object({
    ZENDESK_SUPPORT: emptyString(zod.literal('0').optional()),
  }),
  zod.object({
    ZENDESK_SUPPORT: zod.literal('1'),
    ZENDESK_USERNAME: zod.string(),
    ZENDESK_PASSWORD: zod.string(),
    ZENDESK_SUBDOMAIN: zod.string(),
  }),
]);

const PostgresModel = zod.object({
  POSTGRES_SSL: emptyString(zod.union([zod.literal('1'), zod.literal('0')]).optional()),
  POSTGRES_HOST: zod.string(),
  POSTGRES_PORT: NumberFromString,
  POSTGRES_DB: zod.string(),
  POSTGRES_USER: zod.string(),
  POSTGRES_PASSWORD: zod.string(),
});

const ClickHouseModel = zod.object({
  CLICKHOUSE_PROTOCOL: zod.union([zod.literal('http'), zod.literal('https')]),
  CLICKHOUSE_HOST: zod.string(),
  CLICKHOUSE_PORT: NumberFromString,
  CLICKHOUSE_USERNAME: zod.string(),
  CLICKHOUSE_PASSWORD: zod.string(),
  CLICKHOUSE_REQUEST_TIMEOUT: emptyString(NumberFromString.optional()),
});

const RedisModel = zod.object({
  REDIS_HOST: zod.string(),
  REDIS_PORT: NumberFromString,
  REDIS_PASSWORD: emptyString(zod.string().optional()),
});

const SuperTokensModel = zod.object({
  SUPERTOKENS_CONNECTION_URI: zod.string().url(),
  SUPERTOKENS_API_KEY: zod.string(),
});

const GitHubModel = zod.union([
  zod.object({
    INTEGRATION_GITHUB: emptyString(zod.literal('0').optional()),
  }),
  zod.object({
    INTEGRATION_GITHUB: zod.literal('1'),
    INTEGRATION_GITHUB_APP_ID: NumberFromString,
    INTEGRATION_GITHUB_APP_PRIVATE_KEY: zod.string(),
  }),
]);

const CdnCFModel = zod.union([
  zod.object({
    CDN_CF: emptyString(zod.literal('0').optional()),
  }),
  zod.object({
    CDN_CF: zod.literal('1'),
    CDN_CF_BASE_URL: zod.string(),
  }),
]);

const CdnApiModel = zod.union([
  zod.object({
    CDN_API: emptyString(zod.literal('0').optional()),
  }),
  zod.object({
    CDN_API: zod.literal('1'),
    CDN_API_BASE_URL: zod.string(),
  }),
]);

const HiveModel = zod.union([
  zod.object({ HIVE: emptyString(zod.literal('0').optional()) }),
  zod.object({
    HIVE: zod.literal('1'),
    HIVE_API_TOKEN: zod.string(),
    HIVE_USAGE: zod.union([zod.literal('0'), zod.literal('1')]).optional(),
    HIVE_USAGE_ENDPOINT: zod.string().url().optional(),
    HIVE_USAGE_DATA_RETENTION_PURGE_INTERVAL_MINUTES: emptyString(NumberFromString.optional()),
    HIVE_REPORTING: zod.union([zod.literal('0'), zod.literal('1')]).optional(),
    HIVE_REPORTING_ENDPOINT: zod.string().url().optional(),
  }),
]);

const PrometheusModel = zod.object({
  PROMETHEUS_METRICS: emptyString(zod.union([zod.literal('0'), zod.literal('1')]).optional()),
  PROMETHEUS_METRICS_LABEL_INSTANCE: emptyString(zod.string().optional()),
  PROMETHEUS_METRICS_PORT: emptyString(NumberFromString.optional()),
});

const S3Model = zod.object({
  S3_ENDPOINT: zod.string().url(),
  S3_ACCESS_KEY_ID: zod.string(),
  S3_SECRET_ACCESS_KEY: zod.string(),
  S3_SESSION_TOKEN: emptyString(zod.string().optional()),
  S3_BUCKET_NAME: zod.string(),
  S3_PUBLIC_URL: emptyString(zod.string().url().optional()),
});

const AuthGitHubConfigSchema = zod.union([
  zod.object({
    AUTH_GITHUB: zod.union([zod.void(), zod.literal('0'), zod.literal('')]),
  }),
  zod.object({
    AUTH_GITHUB: zod.literal('1'),
    AUTH_GITHUB_CLIENT_ID: zod.string(),
    AUTH_GITHUB_CLIENT_SECRET: zod.string(),
  }),
]);

const AuthGoogleConfigSchema = zod.union([
  zod.object({
    AUTH_GOOGLE: zod.union([zod.void(), zod.literal('0'), zod.literal('')]),
  }),
  zod.object({
    AUTH_GOOGLE: zod.literal('1'),
    AUTH_GOOGLE_CLIENT_ID: zod.string(),
    AUTH_GOOGLE_CLIENT_SECRET: zod.string(),
  }),
]);

const AuthOktaConfigSchema = zod.union([
  zod.object({
    AUTH_OKTA: zod.union([zod.void(), zod.literal('0')]),
  }),
  zod.object({
    AUTH_OKTA: zod.literal('1'),
    AUTH_OKTA_HIDDEN: emptyString(zod.union([zod.literal('1'), zod.literal('0')]).optional()),
    AUTH_OKTA_ENDPOINT: zod.string().url(),
    AUTH_OKTA_CLIENT_ID: zod.string(),
    AUTH_OKTA_CLIENT_SECRET: zod.string(),
  }),
]);

const AuthOktaMultiTenantSchema = zod.object({
  AUTH_ORGANIZATION_OIDC: emptyString(zod.union([zod.literal('1'), zod.literal('0')]).optional()),
});

const LogModel = zod.object({
  LOG_LEVEL: emptyString(
    zod
      .union([
        zod.literal('trace'),
        zod.literal('debug'),
        zod.literal('info'),
        zod.literal('warn'),
        zod.literal('error'),
        zod.literal('fatal'),
        zod.literal('silent'),
      ])
      .optional(),
  ),
  REQUEST_LOGGING: emptyString(zod.union([zod.literal('0'), zod.literal('1')]).optional()).default(
    '1',
  ),
});

// eslint-disable-next-line no-process-env
const processEnv = process.env;

const configs = {
  base: EnvironmentModel.safeParse(processEnv),
  sentry: SentryModel.safeParse(processEnv),
  postgres: PostgresModel.safeParse(processEnv),
  clickhouse: ClickHouseModel.safeParse(processEnv),
  redis: RedisModel.safeParse(processEnv),
  supertokens: SuperTokensModel.safeParse(processEnv),
  authGithub: AuthGitHubConfigSchema.safeParse(processEnv),
  authGoogle: AuthGoogleConfigSchema.safeParse(processEnv),
  authOkta: AuthOktaConfigSchema.safeParse(processEnv),
  authOktaMultiTenant: AuthOktaMultiTenantSchema.safeParse(processEnv),
  github: GitHubModel.safeParse(processEnv),
  cdnCf: CdnCFModel.safeParse(processEnv),
  cdnApi: CdnApiModel.safeParse(processEnv),
  prometheus: PrometheusModel.safeParse(processEnv),
  hive: HiveModel.safeParse(processEnv),
  s3: S3Model.safeParse(processEnv),
  log: LogModel.safeParse(processEnv),
  zendeskSupport: ZendeskSupportModel.safeParse(processEnv),
};

const environmentErrors: Array<string> = [];

for (const config of Object.values(configs)) {
  if (config.success === false) {
    environmentErrors.push(JSON.stringify(config.error.format(), null, 4));
  }
}

if (environmentErrors.length) {
  const fullError = environmentErrors.join(`\n`);
  console.error('❌ Invalid environment variables:', fullError);
  process.exit(1);
}

function extractConfig<Input, Output>(config: zod.SafeParseReturnType<Input, Output>): Output {
  if (!config.success) {
    throw new Error('Something went wrong.');
  }
  return config.data;
}

const base = extractConfig(configs.base);
const postgres = extractConfig(configs.postgres);
const sentry = extractConfig(configs.sentry);
const clickhouse = extractConfig(configs.clickhouse);
const redis = extractConfig(configs.redis);
const supertokens = extractConfig(configs.supertokens);
const authGithub = extractConfig(configs.authGithub);
const authGoogle = extractConfig(configs.authGoogle);
const authOkta = extractConfig(configs.authOkta);
const authOktaMultiTenant = extractConfig(configs.authOktaMultiTenant);
const github = extractConfig(configs.github);
const prometheus = extractConfig(configs.prometheus);
const log = extractConfig(configs.log);
const cdnCf = extractConfig(configs.cdnCf);
const cdnApi = extractConfig(configs.cdnApi);
const hive = extractConfig(configs.hive);
const s3 = extractConfig(configs.s3);
const zendeskSupport = extractConfig(configs.zendeskSupport);

const hiveConfig =
  hive.HIVE === '1'
    ? {
        token: hive.HIVE_API_TOKEN,
        reporting:
          hive.HIVE_REPORTING === '1' ? { endpoint: hive.HIVE_REPORTING_ENDPOINT ?? null } : null,
        usage:
          hive.HIVE_USAGE === '1'
            ? {
                endpoint: hive.HIVE_USAGE_ENDPOINT ?? null,
              }
            : null,
      }
    : null;

export type HiveConfig = typeof hiveConfig;

export const env = {
  environment: base.ENVIRONMENT,
  release: base.RELEASE ?? 'local',
  encryptionSecret: base.ENCRYPTION_SECRET,
  hiveServices: {
    webApp: {
      url: base.WEB_APP_URL,
    },
    tokens: {
      endpoint: base.TOKENS_ENDPOINT,
    },
    rateLimit: base.RATE_LIMIT_ENDPOINT
      ? {
          endpoint: base.RATE_LIMIT_ENDPOINT,
        }
      : null,
    schemaPolicy: base.SCHEMA_POLICY_ENDPOINT
      ? {
          endpoint: base.SCHEMA_POLICY_ENDPOINT,
        }
      : null,
    usageEstimator: base.USAGE_ESTIMATOR_ENDPOINT
      ? {
          endpoint: base.USAGE_ESTIMATOR_ENDPOINT,
          dateRetentionPurgeIntervalMinutes: 5,
        }
      : null,
    billing: base.BILLING_ENDPOINT ? { endpoint: base.BILLING_ENDPOINT } : null,
    emails: base.EMAILS_ENDPOINT ? { endpoint: base.EMAILS_ENDPOINT } : null,
    webhooks: { endpoint: base.WEBHOOKS_ENDPOINT },
    schema: { endpoint: base.SCHEMA_ENDPOINT },
  },
  http: {
    port: base.PORT ?? 3001,
  },
  postgres: {
    host: postgres.POSTGRES_HOST,
    port: postgres.POSTGRES_PORT,
    db: postgres.POSTGRES_DB,
    user: postgres.POSTGRES_USER,
    password: postgres.POSTGRES_PASSWORD,
    ssl: postgres.POSTGRES_SSL === '1',
  },
  clickhouse: {
    protocol: clickhouse.CLICKHOUSE_PROTOCOL,
    host: clickhouse.CLICKHOUSE_HOST,
    port: clickhouse.CLICKHOUSE_PORT,
    username: clickhouse.CLICKHOUSE_USERNAME,
    password: clickhouse.CLICKHOUSE_PASSWORD,
    requestTimeout: clickhouse.CLICKHOUSE_REQUEST_TIMEOUT,
  },
  redis: {
    host: redis.REDIS_HOST,
    port: redis.REDIS_PORT,
    password: redis.REDIS_PASSWORD ?? '',
  },
  supertokens: {
    connectionURI: supertokens.SUPERTOKENS_CONNECTION_URI,
    apiKey: supertokens.SUPERTOKENS_API_KEY,
  },
  auth: {
    github:
      authGithub.AUTH_GITHUB === '1'
        ? {
            clientId: authGithub.AUTH_GITHUB_CLIENT_ID,
            clientSecret: authGithub.AUTH_GITHUB_CLIENT_SECRET,
          }
        : null,
    google:
      authGoogle.AUTH_GOOGLE === '1'
        ? {
            clientId: authGoogle.AUTH_GOOGLE_CLIENT_ID,
            clientSecret: authGoogle.AUTH_GOOGLE_CLIENT_SECRET,
          }
        : null,
    okta:
      authOkta.AUTH_OKTA === '1'
        ? {
            endpoint: authOkta.AUTH_OKTA_ENDPOINT,
            hidden: authOkta.AUTH_OKTA_HIDDEN === '1',
            clientId: authOkta.AUTH_OKTA_CLIENT_ID,
            clientSecret: authOkta.AUTH_OKTA_CLIENT_SECRET,
          }
        : null,
    organizationOIDC: authOktaMultiTenant.AUTH_ORGANIZATION_OIDC === '1',
    requireEmailVerification: base.AUTH_REQUIRE_EMAIL_VERIFICATION === '1',
  },
  github:
    github.INTEGRATION_GITHUB === '1'
      ? {
          appId: github.INTEGRATION_GITHUB_APP_ID,
          privateKey: github.INTEGRATION_GITHUB_APP_PRIVATE_KEY,
        }
      : null,
  cdn: {
    providers: {
      cloudflare:
        cdnCf.CDN_CF === '1'
          ? {
              baseUrl: cdnCf.CDN_CF_BASE_URL,
            }
          : null,
      api: cdnApi.CDN_API === '1' ? { baseUrl: cdnApi.CDN_API_BASE_URL } : null,
    },
  },
  s3: {
    bucketName: s3.S3_BUCKET_NAME,
    endpoint: s3.S3_ENDPOINT,
    publicUrl: s3.S3_PUBLIC_URL ?? null,
    credentials: {
      accessKeyId: s3.S3_ACCESS_KEY_ID,
      secretAccessKey: s3.S3_SECRET_ACCESS_KEY,
      sessionToken: s3.S3_SESSION_TOKEN,
    },
  },
  organizationOIDC: base.AUTH_ORGANIZATION_OIDC === '1',
  sentry: sentry.SENTRY === '1' ? { dsn: sentry.SENTRY_DSN } : null,
  log: {
    level: log.LOG_LEVEL ?? 'info',
    requests: log.REQUEST_LOGGING === '1',
  },
  prometheus:
    prometheus.PROMETHEUS_METRICS === '1'
      ? {
          labels: {
            instance: prometheus.PROMETHEUS_METRICS_LABEL_INSTANCE ?? 'server',
          },
          port: prometheus.PROMETHEUS_METRICS_PORT ?? 10_254,
        }
      : null,
  hive: hiveConfig,
  graphql: {
    persistedOperationsPath: base.GRAPHQL_PERSISTED_OPERATIONS_PATH ?? null,
    origin: base.GRAPHQL_PUBLIC_ORIGIN,
  },
  zendeskSupport:
    zendeskSupport.ZENDESK_SUPPORT === '1'
      ? {
          username: zendeskSupport.ZENDESK_USERNAME,
          password: zendeskSupport.ZENDESK_PASSWORD,
          subdomain: zendeskSupport.ZENDESK_SUBDOMAIN,
        }
      : null,
} as const;
