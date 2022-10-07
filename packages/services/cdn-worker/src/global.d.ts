export {};

declare global {
  /**
   * KV Storage for the CDN
   */
  let HIVE_DATA: KVNamespace;
  /**
   * Secret used to sign the CDN keys
   */
  let KEY_DATA: string;
  let SENTRY_DSN: string;
  /**
   * Name of the environment, e.g. staging, production
   */
  let SENTRY_ENVIRONMENT: string;
  /**
   * Id of the release
   */
  let SENTRY_RELEASE: string;
}
