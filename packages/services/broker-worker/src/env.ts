export type Env = {
  /**
   * Signature used to verify the origin of the request
   */
  SIGNATURE: string;
  SENTRY_DSN: string;
  /**
   * Name of the environment, e.g. staging, production
   */
  SENTRY_ENVIRONMENT: string;
  /**
   * Id of the release
   */
  SENTRY_RELEASE: string;
  /**
   * Loki (logging)
   */
  LOKI_PASSWORD: string;
  LOKI_USERNAME: string;
  LOKI_ENDPOINT: string;
};
