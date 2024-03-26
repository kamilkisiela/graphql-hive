import { PHASE_PRODUCTION_BUILD } from 'next/constants';
import zod from 'zod';
import * as Sentry from '@sentry/nextjs';
import { getAllEnv } from './read';

// Weird hacky way of getting the Sentry.Integrations object
// When the nextjs config is loaded by Next CLI Sentry has `Integrations` property.
// When nextjs starts and the `environment.js` is loaded, the Sentry object doesn't have the `Integrations` property, it' under `Sentry.default` property.
// Dealing with esm/cjs/default exports is a pain, we all feel that pain...
const Integrations =
  'default' in Sentry
    ? ((Sentry as any).default as typeof Sentry).Integrations
    : Sentry.Integrations;

// treat an empty string `''` as `undefined`
const emptyString = <T extends zod.ZodType>(input: T) => {
  return zod.preprocess((value: unknown) => {
    if (value === '') return undefined;
    return value;
  }, input);
};

const BaseSchema = zod.object({
  NODE_ENV: zod.string(),
  ENVIRONMENT: zod.string(),
  APP_BASE_URL: zod.string().url(),
  GRAPHQL_PUBLIC_ENDPOINT: zod.string().url(),
  GRAPHQL_PUBLIC_ORIGIN: zod.string().url(),
  INTEGRATION_GITHUB_APP_NAME: emptyString(zod.string().optional()),
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

const IntegrationSlackSchema = zod.union([
  zod.object({
    INTEGRATION_SLACK: emptyString(zod.literal('0').optional()),
  }),
  zod.object({
    INTEGRATION_SLACK: zod.literal('1'),
    INTEGRATION_SLACK_CLIENT_ID: zod.string(),
    INTEGRATION_SLACK_CLIENT_SECRET: zod.string(),
  }),
]);

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

const processEnv = getAllEnv();

function buildConfig() {
  const configs = {
    base: BaseSchema.safeParse(processEnv),
    integrationSlack: IntegrationSlackSchema.safeParse(processEnv),
    sentry: SentryConfigSchema.safeParse(processEnv),
    authGithub: AuthGitHubConfigSchema.safeParse(processEnv),
    authGoogle: AuthGoogleConfigSchema.safeParse(processEnv),
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
  const integrationSlack = extractConfig(configs.integrationSlack);
  const sentry = extractConfig(configs.sentry);
  const authGithub = extractConfig(configs.authGithub);
  const authGoogle = extractConfig(configs.authGoogle);
  const authOkta = extractConfig(configs.authOkta);
  const authOktaMultiTenant = extractConfig(configs.authOktaMultiTenant);
  const migrations = extractConfig(configs.migrations);

  const config = {
    release: base.RELEASE ?? 'local',
    nodeEnv: base.NODE_ENV,
    environment: base.ENVIRONMENT,
    appBaseUrl: base.APP_BASE_URL.replace(/\/$/, ''),
    graphqlPublicEndpoint: base.GRAPHQL_PUBLIC_ENDPOINT,
    graphqlPublicOrigin: base.GRAPHQL_PUBLIC_ORIGIN,
    slack:
      integrationSlack.INTEGRATION_SLACK === '1'
        ? {
            clientId: integrationSlack.INTEGRATION_SLACK_CLIENT_ID,
            clientSecret: integrationSlack.INTEGRATION_SLACK_CLIENT_SECRET,
          }
        : null,
    github: base.INTEGRATION_GITHUB_APP_NAME ? { appName: base.INTEGRATION_GITHUB_APP_NAME } : null,
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
      persistedOperations: base.GRAPHQL_PERSISTED_OPERATIONS === '1',
    },
    zendeskSupport: base.ZENDESK_SUPPORT === '1',
    migrations: {
      member_roles_deadline: migrations.MEMBER_ROLES_DEADLINE ?? null,
    },
  } as const;

  return config;
}

const isNextBuilding = processEnv['NEXT_PHASE'] === PHASE_PRODUCTION_BUILD;
export const env = !isNextBuilding ? buildConfig() : noop();

// TODO: I don't like this here, but it seems like it makes most sense here :)
Sentry.init({
  serverName: 'app',
  dist: 'app',
  enabled: !!env.sentry,
  enableTracing: false,
  tracesSampleRate: 1,
  dsn: env.sentry?.dsn,
  release: env.release,
  environment: env.environment,
  integrations: [
    // HTTP integration is only available on the server
    new Integrations.Http({
      tracing: false,
    }),
  ],
});

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
