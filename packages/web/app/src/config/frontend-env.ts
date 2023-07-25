import { env as backendEnv } from '@/env/backend';

/**
 * The configuration for the frontend environment.
 * Don't add any sensitive values here!
 * Everything here must be serializable.
 *
 * **NOTE** Don't import this file in your frontend code. Instead import `@/env/frontend`.
 *
 * You might wonder why there is an optional chaining is used here?
 * It is because Next.js tries to prerender the page lol and during that time we don't have the environment variables. :)
 */
export const env = {
  appBaseUrl: backendEnv.appBaseUrl,
  docsUrl: backendEnv.docsUrl,
  stripePublicKey: backendEnv?.stripePublicKey,
  auth: {
    github: !!backendEnv.auth.github,
    google: !!backendEnv.auth.google,
    okta: backendEnv.auth.okta ? { hidden: backendEnv.auth.okta.hidden } : null,
    legacyAuth0: !!backendEnv.auth.legacyAuth0,
    requireEmailVerification: backendEnv.auth.requireEmailVerification,
    organizationOIDC: backendEnv.auth.organizationOIDC,
  },
  analytics: {
    googleAnalyticsTrackingId: backendEnv?.analytics.googleAnalyticsTrackingId,
    crispWebsiteId: backendEnv?.analytics.crispWebsiteId,
  },
  integrations: {
    slack: !!backendEnv.slack,
  },
  sentry: backendEnv.sentry,
  release: backendEnv.release,
  environment: backendEnv.environment,
  nodeEnv: backendEnv.nodeEnv,
  graphql: {
    persistedOperations: backendEnv.graphql.persistedOperations,
  },
} as const;

declare global {
  // eslint-disable-next-line no-var
  var __frontend_env: typeof env;
}

globalThis['__frontend_env'] = env;
