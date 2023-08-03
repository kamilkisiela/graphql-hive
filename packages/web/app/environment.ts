import zod from 'zod';
import * as Sentry from '@sentry/nextjs';

console.log('🌲 Loading environment variables...');

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
  GRAPHQL_ENDPOINT: zod.string().url(),
  SERVER_ENDPOINT: zod.string().url(),
  EMAILS_ENDPOINT: zod.string().url(),
  SUPERTOKENS_CONNECTION_URI: zod.string().url(),
  SUPERTOKENS_API_KEY: zod.string(),
  INTEGRATION_GITHUB_APP_NAME: emptyString(zod.string().optional()),
  GA_TRACKING_ID: emptyString(zod.string().optional()),
  CRISP_WEBSITE_ID: emptyString(zod.string().optional()),
  DOCS_URL: emptyString(zod.string().url().optional()),
  STRIPE_PUBLIC_KEY: emptyString(zod.string().optional()),
  RELEASE: emptyString(zod.string().optional()),
  AUTH_REQUIRE_EMAIL_VERIFICATION: emptyString(
    zod.union([zod.literal('1'), zod.literal('0')]).optional(),
  ),
  GRAPHQL_PERSISTED_OPERATIONS: emptyString(
    zod.union([zod.literal('1'), zod.literal('0')]).optional(),
  ),
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

const SentryConfigSchema = zod.union([
  zod.object({
    SENTRY: zod.union([zod.void(), zod.literal('0')]),
  }),
  zod.object({
    SENTRY: zod.literal('1'),
    SENTRY_DSN: zod.string(),
  }),
]);

const LegacyAuth0Config = zod.union([
  zod.object({
    AUTH_LEGACY_AUTH0: zod.union([zod.void(), zod.literal('0')]),
  }),
  zod.object({
    AUTH_LEGACY_AUTH0: zod.literal('1'),
    AUTH_LEGACY_AUTH0_AUDIENCE: zod.string(),
    AUTH_LEGACY_AUTH0_ISSUER_BASE_URL: zod.string(),
    AUTH_LEGACY_AUTH0_CLIENT_ID: zod.string(),
    AUTH_LEGACY_AUTH0_CLIENT_SECRET: zod.string(),
    AUTH_LEGACY_AUTH0_INTERNAL_API_ENDPOINT: zod.string(),
    AUTH_LEGACY_AUTH0_INTERNAL_API_KEY: zod.string(),
  }),
]);

const configs = {
  // eslint-disable-next-line no-process-env
  base: BaseSchema.safeParse(process.env),
  // eslint-disable-next-line no-process-env
  integrationSlack: IntegrationSlackSchema.safeParse(process.env),
  // eslint-disable-next-line no-process-env
  sentry: SentryConfigSchema.safeParse(process.env),
  // eslint-disable-next-line no-process-env
  authGithub: AuthGitHubConfigSchema.safeParse(process.env),
  // eslint-disable-next-line no-process-env
  authGoogle: AuthGoogleConfigSchema.safeParse(process.env),
  // eslint-disable-next-line no-process-env
  authOkta: AuthOktaConfigSchema.safeParse(process.env),
  // eslint-disable-next-line no-process-env
  authOktaMultiTenant: AuthOktaMultiTenantSchema.safeParse(process.env),
  // eslint-disable-next-line no-process-env
  authLegacyAuth0: LegacyAuth0Config.safeParse(process.env),
};

const environmentErrors: Array<string> = [];

for (const config of Object.values(configs)) {
  if (config.success === false) {
    environmentErrors.push(JSON.stringify(config.error.format(), null, 4));
  }
}

if (environmentErrors.length) {
  const fullError = environmentErrors.join('\n');
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
const integrationSlack = extractConfig(configs.integrationSlack);
const sentry = extractConfig(configs.sentry);
const authGithub = extractConfig(configs.authGithub);
const authGoogle = extractConfig(configs.authGoogle);
const authOkta = extractConfig(configs.authOkta);
const authOktaMultiTenant = extractConfig(configs.authOktaMultiTenant);
const auth0Legacy = extractConfig(configs.authLegacyAuth0);

const config = {
  release: base.RELEASE ?? 'local',
  nodeEnv: base.NODE_ENV,
  environment: base.ENVIRONMENT,
  appBaseUrl: base.APP_BASE_URL.replace(/\/$/, ''),
  graphqlEndpoint: base.GRAPHQL_ENDPOINT,
  serverEndpoint: base.SERVER_ENDPOINT,
  emailsEndpoint: base.EMAILS_ENDPOINT,
  supertokens: {
    connectionUri: base.SUPERTOKENS_CONNECTION_URI,
    apiKey: base.SUPERTOKENS_API_KEY,
  },
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
    crispWebsiteId: base.CRISP_WEBSITE_ID,
  },
  docsUrl: base.DOCS_URL,
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
    legacyAuth0:
      auth0Legacy.AUTH_LEGACY_AUTH0 === '1'
        ? {
            audience: auth0Legacy.AUTH_LEGACY_AUTH0_AUDIENCE,
            issuerBaseUrl: auth0Legacy.AUTH_LEGACY_AUTH0_ISSUER_BASE_URL,
            clientId: auth0Legacy.AUTH_LEGACY_AUTH0_CLIENT_ID,
            clientSecret: auth0Legacy.AUTH_LEGACY_AUTH0_CLIENT_SECRET,
            internalApi: {
              endpoint: auth0Legacy.AUTH_LEGACY_AUTH0_INTERNAL_API_ENDPOINT,
              apiKey: auth0Legacy.AUTH_LEGACY_AUTH0_INTERNAL_API_KEY,
            },
          }
        : null,
    requireEmailVerification: base.AUTH_REQUIRE_EMAIL_VERIFICATION === '1',
  },
  sentry: sentry.SENTRY === '1' ? { dsn: sentry.SENTRY_DSN } : null,
  stripePublicKey: base.STRIPE_PUBLIC_KEY ?? null,
  graphql: {
    persistedOperations: base.GRAPHQL_PERSISTED_OPERATIONS === '1',
  },
} as const;

declare global {
  // eslint-disable-next-line no-var
  var __backend_env: typeof config;
}

globalThis['__backend_env'] = config;

// TODO: I don't like this here, but it seems like it makes most sense here :)
Sentry.init({
  serverName: 'app',
  enabled: !!config.sentry,
  enableTracing: true,
  tracesSampleRate: 1,
  dsn: config.sentry?.dsn,
  release: config.release,
  environment: config.environment,
  integrations: [
    // HTTP integration is only available on the server
    new Integrations.Http({
      tracing: true,
    }),
  ],
});
