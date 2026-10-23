import { readFileSync } from 'node:fs';
import zod from 'zod';
import { isUUID } from '@hive/api/shared/is-uuid';
import {
  OpenTelemetryConfigurationModel,
  parseClickHouseConfigFromEnvironment,
  parsePostgresConfigFromEnvironment,
  parseRedisConfigFromEnvironment,
  resolveServerListenOptions,
} from '@hive/service-common';

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

function raiseInvariant(reason: string): never {
  throw new Error(reason);
}

const TestUtilsModel = zod.object({
  EXPOSE_MEMORY_UTILS: emptyString(zod.union([zod.literal('1'), zod.literal('0')]).optional()),
});

const RequestBrokerModel = zod.union([
  zod.object({
    REQUEST_BROKER: emptyString(zod.literal('0').optional()),
  }),
  zod.object({
    REQUEST_BROKER: zod.literal('1'),
    REQUEST_BROKER_ENDPOINT: zod.string().min(1),
    REQUEST_BROKER_SIGNATURE: zod.string().min(1),
  }),
]);

const EnvironmentModel = zod.object({
  PORT: emptyString(NumberFromString.optional()),
  SERVER_HOST: emptyString(zod.string().optional()),
  SERVER_HOST_IPV6_ONLY: emptyString(zod.union([zod.literal('1'), zod.literal('0')]).optional()),
  ENVIRONMENT: emptyString(zod.string().optional()),
  RELEASE: emptyString(zod.string().optional()),
  ENCRYPTION_SECRET: emptyString(zod.string()),
  WEB_APP_URL: zod.string().url(),
  GRAPHQL_PUBLIC_ORIGIN: zod
    .string({
      required_error:
        'GRAPHQL_PUBLIC_ORIGIN is required (see: https://github.com/graphql-hive/platform/pull/4288#issue-2195509699)',
    })
    .url(),
  SCHEMA_POLICY_ENDPOINT: emptyString(zod.string().url().optional()),
  SCHEMA_ENDPOINT: zod.string().url(),
  AUTH_ORGANIZATION_OIDC: emptyString(zod.union([zod.literal('1'), zod.literal('0')]).optional()),
  AUTH_ORGANIZATION_SCIM: emptyString(zod.union([zod.literal('1'), zod.literal('0')]).optional()),
  AUTH_REQUIRE_EMAIL_VERIFICATION: emptyString(
    zod.union([zod.literal('1'), zod.literal('0')]).optional(),
  ),
  // Comma-separated list of authorization actions (e.g. `*:describe,alert:modify`) superadmins are
  // granted within organizations they are not a member of. Defaults to `*:describe`,
  // the access superadmins had before this was configurable.
  SUPERADMIN_FOREIGN_ORGANIZATION_ACTIONS: emptyString(zod.string().optional()),
  // Users provisioned (via SCIM) by this organization are treated as superadmins.
  SUPERADMIN_ORGANIZATION_ID: emptyString(zod.string().uuid().optional()),
  FEATURE_FLAGS_APP_DEPLOYMENTS_ENABLED: emptyString(
    zod
      .union([zod.literal('1'), zod.literal('0')])
      .optional()
      .default('1'),
  ),
  FEATURE_FLAGS_SCHEMA_PROPOSALS_ENABLED: emptyString(
    zod.union([zod.literal('1'), zod.literal('0')]).optional(),
  ),
  FEATURE_FLAGS_OTEL_TRACING_ENABLED: emptyString(
    zod.union([zod.literal('1'), zod.literal('0')]).optional(),
  ),
  FEATURE_FLAGS_METRIC_ALERT_RULES_ENABLED: emptyString(
    zod
      .union([zod.literal('1'), zod.literal('0')])
      .optional()
      .default('1'),
  ),
  AWS_REGION: emptyString(zod.string().optional()),
});

const CommerceModel = zod.object({
  COMMERCE_ENDPOINT: emptyString(zod.string().url().optional()),
  COMMERCE_BILLING: zod
    .union([zod.literal('1'), zod.literal('0')])
    .default('1')
    .optional(),
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
    ZENDESK_BASE_URL: zod
      .string()
      .url()
      .transform(url => url.replace(/\/+$/, '')),
  }),
]);

const ClickHouseOptionsModel = zod.object({
  CLICKHOUSE_REQUEST_TIMEOUT: emptyString(NumberFromString.optional()),
});

const SuperTokensModel = zod.object({
  SUPERTOKENS_REFRESH_TOKEN_KEY: zod.string(),
  SUPERTOKENS_ACCESS_TOKEN_KEY: zod.string(),
  SUPERTOKENS_RATE_LIMIT: emptyString(zod.union([zod.literal('1'), zod.literal('0')]).optional()),
  SUPERTOKENS_RATE_LIMIT_IP_HEADER_NAME: emptyString(zod.string().optional()),
  SUPERTOKENS_RATE_LIMIT_BYPASS_KEY: emptyString(zod.string().optional()),
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

const IntegrationRoutesModel = zod.intersection(
  zod.union([
    zod.object({
      INTEGRATION_GITHUB_APP_NAME: emptyString(zod.undefined()),
    }),
    zod.object({
      INTEGRATION_GITHUB_APP_NAME: zod.string(),
      // Used for verifying that the installing user has access to the installation.
      INTEGRATION_GITHUB_APP_CLIENT_ID: zod.string(),
      INTEGRATION_GITHUB_APP_CLIENT_SECRET: zod.string(),
    }),
  ]),
  zod.union([
    zod.object({
      INTEGRATION_SLACK: emptyString(zod.literal('0').optional()),
    }),
    zod.object({
      INTEGRATION_SLACK: zod.literal('1'),
      INTEGRATION_SLACK_CLIENT_ID: zod.string(),
      INTEGRATION_SLACK_CLIENT_SECRET: zod.string(),
    }),
  ]),
);

const CdnCFModel = zod.union([
  zod.object({
    CDN_CF: emptyString(zod.literal('0').optional()),
  }),
  zod.object({
    CDN_CF: zod.literal('1'),
    CDN_CF_BASE_URL: zod.string(),
    CDN_CF_KV_BASE_URL: emptyString(zod.string().url().optional()),
  }),
]);

const CdnApiModel = zod.union([
  zod.object({
    CDN_API: emptyString(zod.literal('0').optional()),
  }),
  zod.object({
    CDN_API: zod.literal('1'),
    CDN_API_BASE_URL: zod.string(),
    CDN_API_KV_BASE_URL: emptyString(zod.string().url().optional()),
  }),
]);

const HiveModel = zod.intersection(
  zod.union([
    zod.object({ HIVE_USAGE: emptyString(zod.literal('0').optional()) }),
    zod.object({
      HIVE_USAGE: zod.literal('1'),
      HIVE_USAGE_ENDPOINT: zod.string().url().optional(),
      HIVE_TARGET: zod.string(),
      HIVE_ACCESS_TOKEN: zod.string(),
      HIVE_FIELD_USAGE_ENABLED: emptyString(
        zod.union([zod.literal('0'), zod.literal('1')]).optional(),
      ),
    }),
  ]),
  zod.union([
    zod.object({ HIVE_TRACING: emptyString(zod.literal('0').optional()) }),
    zod.object({
      HIVE_TRACING: zod.literal('1'),
      HIVE_TRACING_ENDPOINT: zod
        .string()
        .url()
        .default('https://api.graphql-hive.com/otel/v1/traces'),
      HIVE_TARGET: zod.string(),
      HIVE_ACCESS_TOKEN: zod.string(),
    }),
  ]),
);

const PrometheusModel = zod.object({
  PROMETHEUS_METRICS: emptyString(zod.union([zod.literal('0'), zod.literal('1')]).optional()),
  PROMETHEUS_METRICS_LABEL_INSTANCE: emptyString(zod.string().optional()),
  PROMETHEUS_METRICS_PORT: emptyString(NumberFromString.optional()),
});

const S3Model = zod.object({
  S3_ENDPOINT: zod.string().url(),
  S3_ACCESS_KEY_ID: emptyString(zod.string().optional()),
  S3_SECRET_ACCESS_KEY: emptyString(zod.string().optional()),
  S3_SESSION_TOKEN: emptyString(zod.string().optional()),
  S3_BUCKET_NAME: zod.string(),
  S3_AWS_IAM_AUTH_ENABLED: emptyString(zod.union([zod.literal('0'), zod.literal('1')]).optional()),
});

const S3MirrorModel = zod.union([
  zod.object({
    S3_MIRROR: zod.union([zod.void(), zod.literal('0'), zod.literal('')]),
  }),
  zod.object({
    S3_MIRROR: zod.literal('1'),
    S3_MIRROR_ENDPOINT: zod.string().url(),
    S3_MIRROR_ACCESS_KEY_ID: emptyString(zod.string().optional()),
    S3_MIRROR_SECRET_ACCESS_KEY: emptyString(zod.string().optional()),
    S3_MIRROR_SESSION_TOKEN: emptyString(zod.string().optional()),
    S3_MIRROR_BUCKET_NAME: zod.string(),
    S3_MIRROR_PUBLIC_URL: emptyString(zod.string().url().optional()),
    S3_MIRROR_AWS_IAM_AUTH_ENABLED: emptyString(
      zod.union([zod.literal('0'), zod.literal('1')]).optional(),
    ),
  }),
]);

const S3AuditLogModel = zod.union([
  zod.object({
    S3_AUDIT_LOG: zod.union([zod.void(), zod.literal('0'), zod.literal('')]),
  }),
  zod.object({
    S3_AUDIT_LOG: zod.literal('1'),
    S3_AUDIT_LOG_ENDPOINT: zod.string().url(),
    S3_AUDIT_LOG_ACCESS_KEY_ID: emptyString(zod.string().optional()),
    S3_AUDIT_LOG_SECRET_ACCESS_KEY: emptyString(zod.string().optional()),
    S3_AUDIT_LOG_SESSION_TOKEN: emptyString(zod.string().optional()),
    S3_AUDIT_LOG_BUCKET_NAME: zod.string(),
    S3_AUDIT_LOG_PUBLIC_URL: emptyString(zod.string().url().optional()),
    S3_AUDIT_LOG_AWS_IAM_AUTH_ENABLED: emptyString(
      zod.union([zod.literal('0'), zod.literal('1')]).optional(),
    ),
  }),
]);

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

const HivePersistedDocumentsSchema = zod.union([
  zod.object({
    HIVE_PERSISTED_DOCUMENTS: zod.union([zod.void(), zod.literal('0')]),
  }),
  zod.object({
    HIVE_PERSISTED_DOCUMENTS: zod.literal('1'),
    HIVE_PERSISTED_DOCUMENTS_CDN_ENDPOINT: zod.string().url(),
    HIVE_PERSISTED_DOCUMENTS_CDN_ACCESS_KEY_ID: zod.string(),
  }),
]);

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

const OidcWorkloadFederationModel = zod.union([
  zod.object({
    OIDC_WORKLOAD_FEDERATION_IDENTITY_PROVIDER: zod.union([
      zod.void(),
      zod.literal(''),
      zod.literal('0'),
    ]),
  }),
  zod
    .object({
      OIDC_WORKLOAD_FEDERATION_IDENTITY_PROVIDER: zod.literal('azure'),
      AZURE_FEDERATED_TOKEN_FILE: zod.string().min(1),
      OIDC_WORKLOAD_FEDERATION_ORGANIZATION_IDS: zod.string().min(1),
    })
    .superRefine((data, ctx) => {
      try {
        const content = readFileSync(data.AZURE_FEDERATED_TOKEN_FILE, 'utf-8').trim();
        if (!content) {
          ctx.addIssue({
            code: zod.ZodIssueCode.custom,
            path: ['AZURE_FEDERATED_TOKEN_FILE'],
            message: `Federated token file at path '${data.AZURE_FEDERATED_TOKEN_FILE}' is empty.`,
          });
        }
      } catch {
        ctx.addIssue({
          code: zod.ZodIssueCode.custom,
          path: ['AZURE_FEDERATED_TOKEN_FILE'],
          message: `Cannot read federated token file at path '${data.AZURE_FEDERATED_TOKEN_FILE}'. Ensure the file exists and is readable.`,
        });
      }

      const ids = data.OIDC_WORKLOAD_FEDERATION_ORGANIZATION_IDS.split(',').map(s => s.trim());
      const invalid = ids.filter(id => !isUUID(id));
      if (invalid.length > 0) {
        ctx.addIssue({
          code: zod.ZodIssueCode.custom,
          path: ['OIDC_WORKLOAD_FEDERATION_ORGANIZATION_IDS'],
          message: `The following values are not valid UUIDs: ${invalid.join(', ')}`,
        });
      }
    }),
]);

const processEnv = process.env;

const configs = {
  testUtils: TestUtilsModel.safeParse(processEnv),
  requestBroker: RequestBrokerModel.safeParse(processEnv),
  base: EnvironmentModel.safeParse(processEnv),
  commerce: CommerceModel.safeParse(processEnv),
  sentry: SentryModel.safeParse(processEnv),
  clickhouseOptions: ClickHouseOptionsModel.safeParse(processEnv),
  supertokens: SuperTokensModel.safeParse(processEnv),
  authGithub: AuthGitHubConfigSchema.safeParse(processEnv),
  authGoogle: AuthGoogleConfigSchema.safeParse(processEnv),
  authOkta: AuthOktaConfigSchema.safeParse(processEnv),
  authOktaMultiTenant: AuthOktaMultiTenantSchema.safeParse(processEnv),
  github: GitHubModel.safeParse(processEnv),
  integrationRoutes: IntegrationRoutesModel.safeParse(processEnv),
  cdnCf: CdnCFModel.safeParse(processEnv),
  cdnApi: CdnApiModel.safeParse(processEnv),
  prometheus: PrometheusModel.safeParse(processEnv),
  hive: HiveModel.safeParse(processEnv),
  s3: S3Model.safeParse(processEnv),
  s3Mirror: S3MirrorModel.safeParse(processEnv),
  s3AuditLog: S3AuditLogModel.safeParse(processEnv),
  log: LogModel.safeParse(processEnv),
  zendeskSupport: ZendeskSupportModel.safeParse(processEnv),
  tracing: OpenTelemetryConfigurationModel.safeParse(processEnv),
  hivePersistedDocuments: HivePersistedDocumentsSchema.safeParse(processEnv),
  oidcWorkloadFederation: OidcWorkloadFederationModel.safeParse(processEnv),
};

const environmentErrors: Array<string> = [];

for (const config of Object.values(configs)) {
  if (config.success === false) {
    environmentErrors.push(JSON.stringify(config.error.format(), null, 4));
  }
}

if (configs.s3.success && configs.s3.data.S3_AWS_IAM_AUTH_ENABLED !== '1') {
  const missingS3Vars: string[] = [];
  if (!configs.s3.data.S3_ACCESS_KEY_ID) missingS3Vars.push('S3_ACCESS_KEY_ID');
  if (!configs.s3.data.S3_SECRET_ACCESS_KEY) missingS3Vars.push('S3_SECRET_ACCESS_KEY');
  if (missingS3Vars.length > 0) {
    environmentErrors.push(
      `S3_AWS_IAM_AUTH_ENABLED is not enabled so static credentials are required: ${missingS3Vars.join(', ')}`,
    );
  }
}

if (
  configs.s3Mirror.success &&
  configs.s3Mirror.data.S3_MIRROR === '1' &&
  configs.s3Mirror.data.S3_MIRROR_AWS_IAM_AUTH_ENABLED !== '1'
) {
  const missingS3MirrorVars: string[] = [];
  if (!configs.s3Mirror.data.S3_MIRROR_ACCESS_KEY_ID)
    missingS3MirrorVars.push('S3_MIRROR_ACCESS_KEY_ID');
  if (!configs.s3Mirror.data.S3_MIRROR_SECRET_ACCESS_KEY)
    missingS3MirrorVars.push('S3_MIRROR_SECRET_ACCESS_KEY');
  if (missingS3MirrorVars.length > 0) {
    environmentErrors.push(
      `S3_MIRROR_AWS_IAM_AUTH_ENABLED is not enabled so static credentials are required: ${missingS3MirrorVars.join(', ')}`,
    );
  }
}

if (
  configs.s3AuditLog.success &&
  configs.s3AuditLog.data.S3_AUDIT_LOG === '1' &&
  configs.s3AuditLog.data.S3_AUDIT_LOG_AWS_IAM_AUTH_ENABLED !== '1'
) {
  const missingS3AuditVars: string[] = [];
  if (!configs.s3AuditLog.data.S3_AUDIT_LOG_ACCESS_KEY_ID)
    missingS3AuditVars.push('S3_AUDIT_LOG_ACCESS_KEY_ID');
  if (!configs.s3AuditLog.data.S3_AUDIT_LOG_SECRET_ACCESS_KEY)
    missingS3AuditVars.push('S3_AUDIT_LOG_SECRET_ACCESS_KEY');
  if (missingS3AuditVars.length > 0) {
    environmentErrors.push(
      `S3_AUDIT_LOG_AWS_IAM_AUTH_ENABLED is not enabled so static credentials are required: ${missingS3AuditVars.join(', ')}`,
    );
  }
}

if (configs.s3.success && configs.s3.data.S3_AWS_IAM_AUTH_ENABLED !== '1') {
  const missingS3Vars: string[] = [];
  if (!configs.s3.data.S3_ACCESS_KEY_ID) missingS3Vars.push('S3_ACCESS_KEY_ID');
  if (!configs.s3.data.S3_SECRET_ACCESS_KEY) missingS3Vars.push('S3_SECRET_ACCESS_KEY');
  if (missingS3Vars.length > 0) {
    environmentErrors.push(
      `S3_AWS_IAM_AUTH_ENABLED is not enabled so static credentials are required: ${missingS3Vars.join(', ')}`,
    );
  }
}

if (
  configs.s3Mirror.success &&
  configs.s3Mirror.data.S3_MIRROR === '1' &&
  configs.s3Mirror.data.S3_MIRROR_AWS_IAM_AUTH_ENABLED !== '1'
) {
  const missingS3MirrorVars: string[] = [];
  if (!configs.s3Mirror.data.S3_MIRROR_ACCESS_KEY_ID)
    missingS3MirrorVars.push('S3_MIRROR_ACCESS_KEY_ID');
  if (!configs.s3Mirror.data.S3_MIRROR_SECRET_ACCESS_KEY)
    missingS3MirrorVars.push('S3_MIRROR_SECRET_ACCESS_KEY');
  if (missingS3MirrorVars.length > 0) {
    environmentErrors.push(
      `S3_MIRROR_AWS_IAM_AUTH_ENABLED is not enabled so static credentials are required: ${missingS3MirrorVars.join(', ')}`,
    );
  }
}

if (
  configs.s3AuditLog.success &&
  configs.s3AuditLog.data.S3_AUDIT_LOG === '1' &&
  configs.s3AuditLog.data.S3_AUDIT_LOG_AWS_IAM_AUTH_ENABLED !== '1'
) {
  const missingS3AuditVars: string[] = [];
  if (!configs.s3AuditLog.data.S3_AUDIT_LOG_ACCESS_KEY_ID)
    missingS3AuditVars.push('S3_AUDIT_LOG_ACCESS_KEY_ID');
  if (!configs.s3AuditLog.data.S3_AUDIT_LOG_SECRET_ACCESS_KEY)
    missingS3AuditVars.push('S3_AUDIT_LOG_SECRET_ACCESS_KEY');
  if (missingS3AuditVars.length > 0) {
    environmentErrors.push(
      `S3_AUDIT_LOG_AWS_IAM_AUTH_ENABLED is not enabled so static credentials are required: ${missingS3AuditVars.join(', ')}`,
    );
  }
}

const redisConfigResult = parseRedisConfigFromEnvironment(
  processEnv,
  configs.base.success ? configs.base.data.AWS_REGION : undefined,
);

if (redisConfigResult.type === 'error') {
  environmentErrors.push(...redisConfigResult.errors);
}

const postgresConfigResult = parsePostgresConfigFromEnvironment(
  process.env,
  configs.base.success ? configs.base.data.AWS_REGION : undefined,
);

if (postgresConfigResult.type === 'error') {
  environmentErrors.push(...postgresConfigResult.errors);
}

const clickhouseConfigResult = parseClickHouseConfigFromEnvironment(processEnv);

if (clickhouseConfigResult.type === 'error') {
  environmentErrors.push(...clickhouseConfigResult.errors);
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
const commerce = extractConfig(configs.commerce);
const sentry = extractConfig(configs.sentry);
const clickhouseOptions = extractConfig(configs.clickhouseOptions);
const supertokens = extractConfig(configs.supertokens);
const authGithub = extractConfig(configs.authGithub);
const authGoogle = extractConfig(configs.authGoogle);
const authOkta = extractConfig(configs.authOkta);
const authOktaMultiTenant = extractConfig(configs.authOktaMultiTenant);
const github = extractConfig(configs.github);
const integrationRoutes = extractConfig(configs.integrationRoutes);
const prometheus = extractConfig(configs.prometheus);
const log = extractConfig(configs.log);
const cdnCf = extractConfig(configs.cdnCf);
const cdnApi = extractConfig(configs.cdnApi);
const hive = extractConfig(configs.hive);
const s3 = extractConfig(configs.s3);
const s3Mirror = extractConfig(configs.s3Mirror);
const s3AuditLog = extractConfig(configs.s3AuditLog);
const zendeskSupport = extractConfig(configs.zendeskSupport);
const tracing = extractConfig(configs.tracing);
const hivePersistedDocuments = extractConfig(configs.hivePersistedDocuments);
const oidcWorkloadFederation = extractConfig(configs.oidcWorkloadFederation);
const testUtils = extractConfig(configs.testUtils);
const requestBroker = extractConfig(configs.requestBroker);

const hiveUsageConfig =
  hive.HIVE_USAGE === '1'
    ? {
        target: hive.HIVE_TARGET,
        token: hive.HIVE_ACCESS_TOKEN,
        endpoint: hive.HIVE_USAGE_ENDPOINT ?? null,
        fieldLevelMetricsEnabled: hive.HIVE_FIELD_USAGE_ENABLED === '1',
      }
    : null;

const hivePersistedDocumentsConfig =
  hivePersistedDocuments.HIVE_PERSISTED_DOCUMENTS === '1'
    ? {
        cdnEndpoint: hivePersistedDocuments.HIVE_PERSISTED_DOCUMENTS_CDN_ENDPOINT,
        cdnAccessKeyId: hivePersistedDocuments.HIVE_PERSISTED_DOCUMENTS_CDN_ACCESS_KEY_ID,
      }
    : null;

export type HiveUsageConfig = typeof hiveUsageConfig;
export type HivePersistedDocumentsConfig = typeof hivePersistedDocumentsConfig;

export const env = {
  environment: base.ENVIRONMENT,
  exposeMemoryUtils: testUtils.EXPOSE_MEMORY_UTILS === '1',
  release: base.RELEASE ?? 'local',
  requestBroker:
    requestBroker.REQUEST_BROKER === '1'
      ? {
          endpoint: requestBroker.REQUEST_BROKER_ENDPOINT,
          signature: requestBroker.REQUEST_BROKER_SIGNATURE,
        }
      : null,
  encryptionSecret: base.ENCRYPTION_SECRET,
  tracing: {
    enabled: !!tracing.OPENTELEMETRY_COLLECTOR_ENDPOINT || hive.HIVE_TRACING === '1',
    collectorEndpoint: tracing.OPENTELEMETRY_COLLECTOR_ENDPOINT,
    enableConsoleExporter: tracing.OPENTELEMETRY_CONSOLE_EXPORTER === '1',
    hive:
      hive.HIVE_TRACING === '1'
        ? {
            endpoint: hive.HIVE_TRACING_ENDPOINT,
            target: hive.HIVE_TARGET,
            accessToken: hive.HIVE_ACCESS_TOKEN,
          }
        : undefined,
  },
  hiveServices: {
    webApp: {
      url: base.WEB_APP_URL,
    },
    commerce: commerce.COMMERCE_ENDPOINT
      ? {
          endpoint: commerce.COMMERCE_ENDPOINT,
          dateRetentionPurgeIntervalMinutes: 5,
          billing: commerce.COMMERCE_BILLING === '0' ? false : true,
        }
      : null,
    schemaPolicy: base.SCHEMA_POLICY_ENDPOINT
      ? {
          endpoint: base.SCHEMA_POLICY_ENDPOINT,
        }
      : null,
    schema: { endpoint: base.SCHEMA_ENDPOINT },
  },
  integrationRoutes: {
    github:
      'INTEGRATION_GITHUB_APP_CLIENT_ID' in integrationRoutes
        ? {
            appName: integrationRoutes.INTEGRATION_GITHUB_APP_NAME,
            clientId: integrationRoutes.INTEGRATION_GITHUB_APP_CLIENT_ID,
            clientSecret: integrationRoutes.INTEGRATION_GITHUB_APP_CLIENT_SECRET,
          }
        : null,
    slack:
      integrationRoutes.INTEGRATION_SLACK === '1'
        ? {
            clientId: integrationRoutes.INTEGRATION_SLACK_CLIENT_ID,
            clientSecret: integrationRoutes.INTEGRATION_SLACK_CLIENT_SECRET,
          }
        : null,
  },
  http: {
    port: base.PORT ?? 3001,
    ...resolveServerListenOptions({
      serverHost: base.SERVER_HOST,
      serverHostIpv6Only: base.SERVER_HOST_IPV6_ONLY,
    }),
  },
  postgres:
    postgresConfigResult?.type === 'ok'
      ? postgresConfigResult.config
      : raiseInvariant('Unreachable: postgres config errors are caught above via process.exit(1)'),
  clickhouse:
    clickhouseConfigResult.type === 'ok'
      ? {
          ...clickhouseConfigResult.config,
          requestTimeout: clickhouseOptions.CLICKHOUSE_REQUEST_TIMEOUT,
        }
      : raiseInvariant(
          'Unreachable: ClickHouse config errors are caught above via process.exit(1)',
        ),
  redis:
    redisConfigResult?.type === 'ok'
      ? redisConfigResult.config
      : raiseInvariant('Unreachable: redis config errors are caught above via process.exit(1)'),
  supertokens: {
    secrets: {
      refreshTokenKey: supertokens.SUPERTOKENS_REFRESH_TOKEN_KEY,
      accessTokenKey: supertokens.SUPERTOKENS_ACCESS_TOKEN_KEY,
    },
    rateLimit:
      supertokens.SUPERTOKENS_RATE_LIMIT === '0'
        ? null
        : {
            ipHeaderName: supertokens.SUPERTOKENS_RATE_LIMIT_IP_HEADER_NAME ?? 'CF-Connecting-IP',
            bypassKey: supertokens.SUPERTOKENS_RATE_LIMIT_BYPASS_KEY ?? null,
          },
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
    superadminForeignOrganizationActions: (
      base.SUPERADMIN_FOREIGN_ORGANIZATION_ACTIONS ?? '*:describe'
    )
      .split(',')
      .map(action => action.trim())
      .filter(Boolean),
    superadminOrganizationId: base.SUPERADMIN_ORGANIZATION_ID ?? null,
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
              kv: cdnCf.CDN_CF_KV_BASE_URL ? { baseUrl: cdnCf.CDN_CF_KV_BASE_URL } : null,
            }
          : null,
      api:
        cdnApi.CDN_API === '1'
          ? {
              baseUrl: cdnApi.CDN_API_BASE_URL,
              kv: cdnApi.CDN_API_KV_BASE_URL ? { baseUrl: cdnApi.CDN_API_KV_BASE_URL } : null,
            }
          : null,
    },
  },
  s3: {
    bucketName: s3.S3_BUCKET_NAME,
    endpoint: s3.S3_ENDPOINT,
    awsIamAuthEnabled: s3.S3_AWS_IAM_AUTH_ENABLED === '1',
    credentials: {
      accessKeyId: s3.S3_ACCESS_KEY_ID,
      secretAccessKey: s3.S3_SECRET_ACCESS_KEY,
      sessionToken: s3.S3_SESSION_TOKEN,
    },
  },
  s3Mirror:
    s3Mirror.S3_MIRROR === '1'
      ? {
          bucketName: s3Mirror.S3_MIRROR_BUCKET_NAME,
          endpoint: s3Mirror.S3_MIRROR_ENDPOINT,
          publicUrl: s3Mirror.S3_MIRROR_PUBLIC_URL ?? null,
          awsIamAuthEnabled: s3Mirror.S3_MIRROR_AWS_IAM_AUTH_ENABLED === '1',
          credentials: {
            accessKeyId: s3Mirror.S3_MIRROR_ACCESS_KEY_ID,
            secretAccessKey: s3Mirror.S3_MIRROR_SECRET_ACCESS_KEY,
            sessionToken: s3Mirror.S3_MIRROR_SESSION_TOKEN,
          },
        }
      : null,
  s3AuditLogs:
    s3AuditLog.S3_AUDIT_LOG === '1'
      ? {
          bucketName: s3AuditLog.S3_AUDIT_LOG_BUCKET_NAME,
          endpoint: s3AuditLog.S3_AUDIT_LOG_ENDPOINT,
          publicUrl: s3AuditLog.S3_AUDIT_LOG_PUBLIC_URL ?? null,
          awsIamAuthEnabled: s3AuditLog.S3_AUDIT_LOG_AWS_IAM_AUTH_ENABLED === '1',
          credentials: {
            accessKeyId: s3AuditLog.S3_AUDIT_LOG_ACCESS_KEY_ID,
            secretAccessKey: s3AuditLog.S3_AUDIT_LOG_SECRET_ACCESS_KEY,
            sessionToken: s3AuditLog.S3_AUDIT_LOG_SESSION_TOKEN,
          },
        }
      : null,
  organizationOIDC: base.AUTH_ORGANIZATION_OIDC === '1',
  organizationSCIM: base.AUTH_ORGANIZATION_SCIM === '1',
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
  hive: hiveUsageConfig,
  hivePersistedDocuments: hivePersistedDocumentsConfig,
  graphql: {
    origin: base.GRAPHQL_PUBLIC_ORIGIN,
  },
  zendeskSupport:
    zendeskSupport.ZENDESK_SUPPORT === '1'
      ? {
          username: zendeskSupport.ZENDESK_USERNAME,
          password: zendeskSupport.ZENDESK_PASSWORD,
          baseUrl: zendeskSupport.ZENDESK_BASE_URL,
        }
      : null,
  featureFlags: {
    /** Whether app deployments should be enabled by default for everyone. */
    appDeploymentsEnabled: base.FEATURE_FLAGS_APP_DEPLOYMENTS_ENABLED === '1',
    /** Whether schema proposals should be enabled for all organizations. */
    schemaProposalsEnabled: base.FEATURE_FLAGS_SCHEMA_PROPOSALS_ENABLED === '1',
    /** Whether OTEL tracing should be enabled for all organizations. */
    otelTracingEnabled: base.FEATURE_FLAGS_OTEL_TRACING_ENABLED === '1',
    /** Whether metric alert rules should be enabled cluster-wide. */
    metricAlertRulesEnabled: base.FEATURE_FLAGS_METRIC_ALERT_RULES_ENABLED === '1',
  },
  oidcWorkloadFederation:
    oidcWorkloadFederation.OIDC_WORKLOAD_FEDERATION_IDENTITY_PROVIDER === 'azure'
      ? {
          provider: 'azure' as const,
          tokenFilePath: oidcWorkloadFederation.AZURE_FEDERATED_TOKEN_FILE,
          organizationIds: oidcWorkloadFederation.OIDC_WORKLOAD_FEDERATION_ORGANIZATION_IDS.split(
            ',',
          ).map(s => s.trim()),
        }
      : null,
} as const;
