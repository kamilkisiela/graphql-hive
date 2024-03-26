import { PHASE_PRODUCTION_BUILD } from 'next/constants';
import zod from 'zod';
import type { AllowedEnvironmentVariables } from './frontend-public-variables';
import { getAllEnv } from './read';

type RestrictKeys<T, K> = {
  [P in keyof T]: P extends K ? T[P] : never;
};

// Makes sure the list of available environment variables (ALLOWED_ENVIRONMENT_VARIABLES in 'frontend-public-variables.ts') is in sync with the zod schema.
// If you add/remove an environment variable, make sure to modify it there as well
// Example: If `NODE_ENV` is not one of the allowed values, TypeScript will detect a type error.
//
// {
//   NOT_FOUND: zod.string(),
//   ^ Type 'ZodString' is not assignable to type 'never'.
//   NODE_ENV: zod.string(),
// }
//
function protectedObject<
  T extends {
    [K in keyof T]: zod.ZodTypeAny;
  },
>(shape: RestrictKeys<T, AllowedEnvironmentVariables>) {
  return zod.object(shape);
}

// treat an empty string `''` as `undefined`
const emptyString = <T extends zod.ZodType>(input: T) => {
  return zod.preprocess((value: unknown) => {
    if (value === '') return undefined;
    return value;
  }, input);
};

const enabledOrDisabled = emptyString(zod.union([zod.literal('1'), zod.literal('0')]).optional());

// todo: reuse backend schema

const BaseSchema = protectedObject({
  NODE_ENV: zod.string(),
  ENVIRONMENT: zod.string(),
  APP_BASE_URL: zod.string().url(),
  GRAPHQL_PUBLIC_ENDPOINT: zod.string().url(),
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
  ZENDESK_SUPPORT: enabledOrDisabled,
});

const IntegrationSlackSchema = protectedObject({
  INTEGRATION_SLACK: enabledOrDisabled,
});

const AuthGitHubConfigSchema = protectedObject({
  AUTH_GITHUB: enabledOrDisabled,
});

const AuthGoogleConfigSchema = protectedObject({
  AUTH_GOOGLE: enabledOrDisabled,
});

const AuthOktaConfigSchema = protectedObject({
  AUTH_OKTA: enabledOrDisabled,
  AUTH_OKTA_HIDDEN: enabledOrDisabled,
});

const AuthOktaMultiTenantSchema = protectedObject({
  AUTH_ORGANIZATION_OIDC: enabledOrDisabled,
});

const SentryConfigSchema = zod.union([
  protectedObject({
    SENTRY: zod.union([zod.void(), zod.literal('0')]),
  }),
  protectedObject({
    SENTRY: zod.literal('1'),
    SENTRY_DSN: zod.string(),
  }),
]);

const MigrationsSchema = protectedObject({
  MEMBER_ROLES_DEADLINE: emptyString(
    zod
      .date({
        coerce: true,
      })
      .optional(),
  ),
});

const envValues = getAllEnv();

function buildConfig() {
  const configs = {
    base: BaseSchema.safeParse(envValues),
    integrationSlack: IntegrationSlackSchema.safeParse(envValues),
    sentry: SentryConfigSchema.safeParse(envValues),
    authGithub: AuthGitHubConfigSchema.safeParse(envValues),
    authGoogle: AuthGoogleConfigSchema.safeParse(envValues),
    authOkta: AuthOktaConfigSchema.safeParse(envValues),
    authOktaMultiTenant: AuthOktaMultiTenantSchema.safeParse(envValues),
    migrations: MigrationsSchema.safeParse(envValues),
  };

  const environmentErrors: Array<string> = [];

  for (const config of Object.values(configs)) {
    if (config.success === false) {
      environmentErrors.push(JSON.stringify(config.error.format(), null, 4));
    }
  }

  if (environmentErrors.length) {
    const fullError = environmentErrors.join('\n');
    console.error('❌ Invalid (frontend) environment variables:', fullError);
    throw new Error('Invalid environment variables.');
  }

  function extractConfig<Input, Output>(config: zod.SafeParseReturnType<Input, Output>): Output {
    if (!config.success) {
      throw new Error('Something went wrong.');
    }
    return config.data;
  }

  const base = extractConfig(configs.base);
  const integrationSlack = extractConfig(configs.integrationSlack);
  const sentry = extractConfig(configs.sentry);
  const authGithub = extractConfig(configs.authGithub);
  const authGoogle = extractConfig(configs.authGoogle);
  const authOkta = extractConfig(configs.authOkta);
  const authOktaMultiTenant = extractConfig(configs.authOktaMultiTenant);
  const migrations = extractConfig(configs.migrations);

  return {
    appBaseUrl: base.APP_BASE_URL.replace(/\/$/, ''),
    graphqlPublicEndpoint: base.GRAPHQL_PUBLIC_ENDPOINT,
    graphqlPublicOrigin: base.GRAPHQL_PUBLIC_ORIGIN,
    docsUrl: base.DOCS_URL,
    stripePublicKey: base.STRIPE_PUBLIC_KEY ?? null,
    auth: {
      github: authGithub.AUTH_GITHUB === '1',
      google: authGoogle.AUTH_GOOGLE === '1',
      okta: authOkta.AUTH_OKTA === '1' ? { hidden: authOkta.AUTH_OKTA_HIDDEN === '1' } : null,
      requireEmailVerification: base.AUTH_REQUIRE_EMAIL_VERIFICATION === '1',
      organizationOIDC: authOktaMultiTenant.AUTH_ORGANIZATION_OIDC === '1',
    },
    analytics: {
      googleAnalyticsTrackingId: base.GA_TRACKING_ID,
    },
    integrations: {
      slack: integrationSlack.INTEGRATION_SLACK === '1',
    },
    sentry: sentry.SENTRY === '1' ? { dsn: sentry.SENTRY_DSN } : null,
    release: base.RELEASE ?? 'local',
    environment: base.ENVIRONMENT,
    nodeEnv: base.NODE_ENV,
    graphql: {
      persistedOperations: base.GRAPHQL_PERSISTED_OPERATIONS === '1',
    },
    zendeskSupport: base.ZENDESK_SUPPORT === '1',
    migrations: {
      member_roles_deadline: migrations.MEMBER_ROLES_DEADLINE ?? null,
    },
  } as const;
}

const isNextBuilding = envValues['NEXT_PHASE'] === PHASE_PRODUCTION_BUILD;
export const env = !isNextBuilding ? buildConfig() : noop();

/**
 * Next.js is so kind and tries to pre-render our page without the environment information being available... :)
 * Non of our pages can actually be pre-rendered without first running the backend as it requires the runtime environment variables.
 * So we just return a noop. :)
 */
function noop(): any {
  return new Proxy(new String(''), {
    get(obj, prop) {
      if (prop === Symbol.toPrimitive) {
        return () => undefined;
      }
      if (prop in String.prototype) {
        return obj[prop as any];
      }
      return noop();
    },
  });
}
