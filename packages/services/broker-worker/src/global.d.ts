export {};

interface AnalyticsEngine {
  writeDataPoint(input: { blobs?: string[]; doubles?: number[]; indexes?: string[] }): void;
}

declare global {
  /**
   * Signature used to verify the origin of the request
   */
  let SIGNATURE: string;
  let SENTRY_DSN: string;
  /**
   * Name of the environment, e.g. staging, production
   */
  let SENTRY_ENVIRONMENT: string;
  /**
   * Id of the release
   */
  let SENTRY_RELEASE: string;
  /**
   * Loki (logging)
   */
  let LOKI_PASSWORD: string;
  let LOKI_USERNAME: string;
  let LOKI_ENDPOINT: string;
}
