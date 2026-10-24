import zod from 'zod';
import { resolveServerListenOptions } from '@hive/service-common/listen-options';
import * as Sentry from '@sentry/node';
import { ALLOWED_ENVIRONMENT_VARIABLES } from './frontend-public-variables';

/**
 * Get public environment variables that are allowed to be exposed to the frontend as a key-value object.
 */
export function getPublicEnvVars() {
  const envObject: Record<string, unknown> = {};
  // eslint-disable-next-line no-process-env
  const processEnv = process.env;

  for (const key in processEnv) {
    if ((ALLOWED_ENVIRONMENT_VARIABLES as readonly string[]).includes(key)) {
      envObject[key] = processEnv[key];
    }
  }

  return envObject;
}

// treat an empty string `''` as `undefined`
const emptyString = <T extends zod.ZodType>(input: T) => {
  return zod.preprocess((value: unknown) => {
    if (value === '') return undefined;
    return value;
  }, input);
};

const isNumberString = (input: unknown) => zod.string().regex(/^\d+$/).safeParse(input).success;

const numberFromNumberOrNumberString = (input: unknown): number | undefined => {
  if (typeof input === 'number') return input;
  if (isNumberString(input)) return Number(input);
};

const NumberFromString = (min = 1) =>
  zod.preprocess(numberFromNumberOrNumberString, zod.number().min(min));

const BaseSchema = zod.object({
  NODE_ENV: zod.string().default('development'),
  ENVIRONMENT: zod.string(),
  PORT: emptyString(NumberFromString().optional()),
  SERVER_HOST: emptyString(zod.string().optional()),
  SERVER_HOST_IPV6_ONLY: emptyString(zod.union([zod.literal('1'), zod.literal('0')]).optional()),
  APP_BASE_URL: zod.string().url(),
  GRAPHQL_PUBLIC_ENDPOINT: zod.string().url(),
  GRAPHQL_PUBLIC_SUBSCRIPTION_ENDPOINT: zod.string().url(),
  GRAPHQL_PUBLIC_ORIGIN: zod.string().url(),
  GA_TRACKING_ID: emptyString(zod.string().optional()),
  DOCS_URL: emptyString(zod.string().url().optional()),
  STRIPE_PUBLIC_KEY: emptyString(zod.string().optional()),
  RELEASE: emptyString(zod.string().optional()),
  AUTH_REQUIRE_EMAIL_VERIFICATION: emptyString(
    zod.union([zod.literal('1'), zod.literal('0')]).optional(),
  ),
  GRAPHQL_PERSISTED_OPERATIONS: emptyString(
    zod.union([zod.literal('1'), zod.literal('0')]).optional(),
  ),
  ZENDESK_SUPPORT: emptyString(zod.union([zod.literal('1'), zod.literal('0')]).optional()),
});

const AuthGitHubConfigSchema = zod.object({
  AUTH_GITHUB: emptyString(zod.union([zod.literal('1'), zod.literal('0')]).optional()),
});

const AuthGoogleConfigSchema = zod.object({
  AUTH_GOOGLE: emptyString(zod.union([zod.literal('1'), zod.literal('0')]).optional()),
});

const AuthOktaConfigSchema = zod.object({
  AUTH_OKTA: emptyString(zod.union([zod.literal('1'), zod.literal('0')]).optional()),
  AUTH_OKTA_HIDDEN: emptyString(zod.union([zod.literal('1'), zod.literal('0')]).optional()),
});

const AuthOktaMultiTenantSchema = zod.object({
  AUTH_ORGANIZATION_OIDC: emptyString(zod.union([zod.literal('1'), zod.literal('0')]).optional()),
});

const SentryConfigSchema = zod.union([
  zod.object({
    SENTRY: zod.union([zod.void(), zod.literal('0')]),
  }),
  zod.object({
    SENTRY: zod.literal('1'),
    SENTRY_DSN: zod.string(),
  }),
]);

const MigrationsSchema = zod.object({
  MEMBER_ROLES_DEADLINE: emptyString(
    zod
      .date({
        coerce: true,
      })
      .optional(),
  ),
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
});

// eslint-disable-next-line no-process-env
const processEnv = process.env;

function buildConfig() {
  const configs = {
    base: BaseSchema.safeParse(processEnv),
    sentry: SentryConfigSchema.safeParse(processEnv),
    authGithub: AuthGitHubConfigSchema.safeParse(processEnv),
    authGoogle: AuthGoogleConfigSchema.safeParse(processEnv),
    log: LogModel.safeParse(processEnv),
    authOkta: AuthOktaConfigSchema.safeParse(processEnv),
    authOktaMultiTenant: AuthOktaMultiTenantSchema.safeParse(processEnv),
    migrations: MigrationsSchema.safeParse(processEnv),
  };

  const environmentErrors: Array<string> = [];

  for (const config of Object.values(configs)) {
    if (config.success === false) {
      environmentErrors.push(JSON.stringify(config.error.format(), null, 4));
    }
  }

  if (environmentErrors.length) {
    const fullError = environmentErrors.join('\n');
    console.error('❌ Invalid (backend) environment variables:', fullError);
    process.exit(1);
  }

  function extractConfig<Input, Output>(config: zod.SafeParseReturnType<Input, Output>): Output {
    if (!config.success) {
      throw new Error('Something went wrong.');
    }
    return config.data;
  }

  const base = extractConfig(configs.base);
  const sentry = extractConfig(configs.sentry);
  const authGithub = extractConfig(configs.authGithub);
  const authGoogle = extractConfig(configs.authGoogle);
  const authOkta = extractConfig(configs.authOkta);
  const authOktaMultiTenant = extractConfig(configs.authOktaMultiTenant);
  const migrations = extractConfig(configs.migrations);
  const log = extractConfig(configs.log);

  const config = {
    port: base.PORT ?? 3000,
    ...resolveServerListenOptions({
      serverHost: base.SERVER_HOST,
      serverHostIpv6Only: base.SERVER_HOST_IPV6_ONLY,
    }),
    release: base.RELEASE ?? 'local',
    nodeEnv: base.NODE_ENV,
    environment: base.ENVIRONMENT,
    appBaseUrl: base.APP_BASE_URL.replace(/\/$/, ''),
    graphqlPublicEndpoint: base.GRAPHQL_PUBLIC_ENDPOINT,
    graphqlPublicOrigin: base.GRAPHQL_PUBLIC_ORIGIN,
    log: {
      level: log.LOG_LEVEL ?? 'info',
    },
    analytics: {
      googleAnalyticsTrackingId: base.GA_TRACKING_ID,
    },
    docsUrl: base.DOCS_URL,
    auth: {
      github: {
        enabled: authGithub.AUTH_GITHUB === '1',
      },
      google: {
        enabled: authGoogle.AUTH_GOOGLE === '1',
      },
      okta: {
        enabled: authOkta.AUTH_OKTA === '1',
        hidden: authOkta.AUTH_OKTA_HIDDEN === '1',
      },
      organizationOIDC: authOktaMultiTenant.AUTH_ORGANIZATION_OIDC === '1',
      requireEmailVerification: base.AUTH_REQUIRE_EMAIL_VERIFICATION === '1',
    },
    sentry: sentry.SENTRY === '1' ? { dsn: sentry.SENTRY_DSN } : null,
    stripePublicKey: base.STRIPE_PUBLIC_KEY ?? null,
    graphql: {
      persistedOperationsPrefix:
        base.GRAPHQL_PERSISTED_OPERATIONS === '1' ? `hive-app/${base.RELEASE}/` : null,
    },
    zendeskSupport: base.ZENDESK_SUPPORT === '1',
    migrations: {
      member_roles_deadline: migrations.MEMBER_ROLES_DEADLINE ?? null,
    },
  } as const;

  return config;
}

export const env = buildConfig();

Sentry.init({
  serverName: 'app',
  dist: 'app',
  enabled: !!env.sentry,
  enableTracing: false,
  tracesSampleRate: 1,
  dsn: env.sentry?.dsn,
  release: env.release,
  environment: env.environment,
});
