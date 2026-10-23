import type {
  DocumentNode,
  ExecutionArgs,
  GraphQLError,
  GraphQLErrorExtensions,
  GraphQLSchema,
} from 'graphql';
import type { PromiseOrValue } from 'graphql/jsutils/PromiseOrValue.js';
import { LogLevel as HiveLoggerLevel, Logger } from '@graphql-hive/logger';
import { MaybePromise } from '@graphql-tools/utils';
import type { AgentOptions } from './agent.js';
import { CircuitBreakerConfiguration } from './circuit-breaker.js';
import type { autoDisposeSymbol, hiveClientSymbol } from './client.js';
import type { PersistedDocumentsManifest } from './persisted-documents.js';
import type { SchemaReporter } from './reporting.js';

type HeadersObject = {
  get(name: string): string | null;
};

export type TrackGatewayErrorsCallback = (args: {
  errors?: any[] | readonly Error[] | readonly GraphQLError[] | null;
}) => void;

export type SubRequestCallback = (args: {
  /** Which subgraph resolved this path */
  subgraph: string;

  /**
   * If this is an entity request, then this is the coordinate in the original operation that is being resolved.
   * If undefined, then the path is assumed to be 'Query'.
   */
  paths?: string[] | string;

  /**
   * What type of request this is. Root is if resolving a root query/mutation field. Entity is
   * if resolving an entity type in federation.
   * */
  type: 'ROOT' | 'ENTITY';
}) => FinishSubRequestCallback;

export type FinishSubRequestCallback = (args: {
  /** HTTP Status Code */
  status: number;

  /** Used to calculate error code for a coordinate, with a code returned from the graphql extensions */
  result?: GraphQLResult;

  /** The GraphQL schema being accessed. Used to calculate coordinate from error path and the coordinate for field counts */
  subgraphSchema: GraphQLSchema;

  /** GraphQL operation document. Used to calculate field counts. */
  document: DocumentNode;
}) => void;

/**
 * Identifies the graph version (e.g. the supergraph fetched from the Hive CDN) an operation was executed against.
 * The values are provided by `createCDNArtifactFetcher` via the `graphId` and `graphVersionId` fields.
 * Both values are required (and must be UUIDs) for the graph version to be reported.
 */
export type GraphVersionInfo = {
  /** The graph id the operation was executed against (as provided by the CDN artifact fetcher). */
  graphId: string;
  /** The graph version id the operation was executed against (as provided by the CDN artifact fetcher). */
  graphVersionId: string;
};

export type CollectUsage = {
  trackGatewayErrors: TrackGatewayErrorsCallback;
  subrequest: SubRequestCallback;
  finish: CollectUsageCallback;
};

export type CollectUsageOptions = {
  /** The graph the operation is executed against (as provided by the CDN artifact fetcher). */
  graph?: GraphVersionInfo | null;
};

export interface HiveClient {
  [hiveClientSymbol]: true;
  [autoDisposeSymbol]: boolean | NodeJS.Signals[];
  info(): void | Promise<void>;
  reportSchema: SchemaReporter['report'];
  /** Collect usage for Query and Mutation operations */
  collectUsage(options?: CollectUsageOptions): CollectUsage;
  /** Collect usage for Query and Mutation operations */
  collectRequest(args: {
    args: ExecutionArgs;
    result: GraphQLResult | AbortAction;
    duration: number;
    /**
     * Persisted document if request is using a persisted document.
     * It needs to be provided in order to collect app deployment specific information.
     */
    experimental__persistedDocumentHash?: string;
    /** The graph the operation was executed against (as provided by the CDN artifact fetcher). */
    graph?: GraphVersionInfo | null;
  }): void;
  /** Collect usage for Subscription operations */
  collectSubscriptionUsage(args: {
    args: ExecutionArgs;
    /**
     * Persisted document if subscription is a persisted document.
     * It needs to be provided in order to collect app deployment specific information.
     */
    experimental__persistedDocumentHash?: string;
    /** The graph the operation was executed against (as provided by the CDN artifact fetcher). */
    graph?: GraphVersionInfo | null;
  }): void;
  createInstrumentedExecute(executeImpl: any): any;
  createInstrumentedSubscribe(executeImpl: any): any;
  dispose(): Promise<void>;
  persistedDocuments: null | {
    manifest(
      deployment: { appName: string; appVersion: string },
      context?: { waitUntil?: (promise: Promise<void> | void) => void },
    ): PromiseOrValue<PersistedDocumentsManifest | null>;
    resolve(
      documentId: string,
      context?: { waitUntil?: (promise: Promise<void> | void) => void },
    ): PromiseOrValue<string | null>;
    allowArbitraryDocuments(context: { headers?: HeadersObject }): PromiseOrValue<boolean>;
  };
}

export type { PersistedDocumentsManifest };

export type AsyncIterableIteratorOrValue<T> = AsyncIterableIterator<T> | T;
export type AsyncIterableOrValue<T> = AsyncIterable<T> | T;
export type AbortAction = {
  action: 'abort';
  reason: string;
  logging: boolean;
};

export type CollectUsageCallback = (
  args: ExecutionArgs,
  result: GraphQLResult | AbortAction,
  /**
   * Persisted document if subscription is a persisted document.
   * It needs to be provided in order to collect app deployment specific information.
   */
  experimental__persistedDocumentHash?: string,
) => Promise<void>;

export interface ClientInfo {
  name: string;
  version: string;
}

/** @deprecated Instead provide a logger instance from `@graphql-hive/logger`. */
export interface LegacyLogger {
  info(msg: string): void;
  error(error: any, ...data: any[]): void;
  debug?(msg: string): void;
}

export interface HiveUsagePluginOptions {
  /**
   * The target to which the usage data should be reported to.
   * This can either be a slug following the format `$organizationSlug/$projectSlug/$targetSlug` (e.g `the-guild/graphql-hive/staging`)
   * or an UUID (e.g. `a0f4c605-6541-4350-8cfe-b31f21a4bf80`).
   */
  target?: string;
  /**
   * Custom endpoint to collect schema usage
   *
   * @deprecated use `options.selfHosting.usageEndpoint` instead
   *
   * Points to Hive by default
   */
  endpoint?: string;
  /**
   * Extract client info from GraphQL Context
   */
  clientInfo?(context: any): null | undefined | ClientInfo;
  /**
   * Hive uses LRU cache to store info about operations.
   * This option represents the maximum size of the cache.
   *
   * Default: 1000
   */
  max?: number;
  /**
   * Hive uses LRU cache to store info about operations.
   * This option represents the time-to-live of every cached operation.
   *
   * Default: no ttl
   */
  ttl?: number;
  /**
   * A list of operations (by name or regular expression) that should be excluded from reporting.
   */
  exclude?: Array<string | RegExp>;
  /**
   * Sample rate to determine sampling.
   * 0.0 = 0% chance of being sent
   * 1.0 = 100% chance of being sent.
   *
   * Default: 1.0
   */
  sampleRate?: number;
  /**
   * Compute sample rate dynamically.
   *
   * If `sampler` is defined, `sampleRate` is ignored.
   *
   * @returns A sample rate between 0 and 1.
   * 0.0 = 0% chance of being sent
   * 1.0 = 100% chance of being sent.
   * true = 100%
   * false = 0%
   */
  sampler?: (context: SamplingContext) => number | boolean;
  /**
   * (Experimental) Enables collecting Input fields usage based on the variables passed to the operation.
   *
   * Default: false
   */
  processVariables?: boolean;

  /**
   * Report usage data for resolved coordinates. This counts the number of times a coordinate is resolved and reports
   * graphql errors and their codes to Hive. Before enabling this, be aware that this is CPU intensive since it must
   * iterate over the entire response payload.
   *
   * Default: false
   */
  fieldLevelMetricsEnabled?: boolean;
}

export interface SamplingContext
  extends Pick<ExecutionArgs, 'document' | 'contextValue' | 'variableValues'> {
  operationName: string;
}

export interface HiveReportingPluginOptions {
  /**
   * Custom endpoint to collect schema reports
   *
   * @deprecated use `options.selfHosting.usageEndpoint` instead
   *
   * Points to Hive by default
   */
  endpoint?: string;
  /**
   * Author of current version of the schema
   */
  author: string;
  /**
   * Commit SHA hash (or any identifier) related to the schema version
   */
  commit: string;
  /**
   * URL to the service (use only for distributed schemas)
   */
  serviceUrl?: string;
  /**
   * Name of the service (use only for distributed schemas)
   */
  serviceName?: string;
}

export interface HiveSelfHostingOptions {
  /**
   * Point to your own instance of Hive Console API
   *
   * Used by schema reporting and token info.
   */
  graphqlEndpoint: string;
  /**
   * Address of your own Hive Console application
   *
   * Used by token info to generate a link to the organization, project and target.
   */
  applicationUrl: string;
  /**
   * Point to your own instance of Hive Console Usage API
   *
   * Used by usage reporting
   */
  usageEndpoint?: string;
}

type OptionalWhenFalse<T, KCond extends keyof T, KExcluded extends keyof T> =
  // untouched by default or when true
  | T
  // when false, make KExcluded optional
  | (Omit<T, KExcluded> & { [_P in KCond]: false } & { [_P in KExcluded]?: T[KExcluded] });

export type HivePluginOptions = OptionalWhenFalse<
  {
    /**
     * Enable/Disable Hive usage reporting
     *
     * Default: true
     */
    enabled?: boolean;
    /**
     * Debugging mode
     *
     * Default: false
     *
     * @deprecated Use the {logger} property instead.
     */
    debug?: boolean;
    /**
     * Custom logger.
     *
     * Default: 'info'
     */
    logger?: Logger | HiveLoggerLevel;
    /**
     * Access Token for usage reporting
     */
    token: string;
    /**
     * Use when self-hosting Hive Console
     */
    selfHosting?: HiveSelfHostingOptions;
    agent?: Omit<AgentOptions, 'endpoint' | 'token' | 'enabled' | 'debug'>;
    /**
     * Collects schema usage based on operations
     *
     * Disabled by default
     */
    usage?: HiveUsagePluginOptions | boolean;
    /**
     * Schema reporting
     *
     * Disabled by default
     *
     * @deprecated Use Hive CLI (@graphql-hive/cli) to publish the schema file instead. This is prevents an issue where multiple service instances result in numerous publishes to Hive.
     */
    reporting?: HiveReportingPluginOptions | false;
    /**
     * Print info about the token.
     * Disabled by default (enabled by default only in debug mode)
     *
     * **Note:** The new access tokens do not support printing the token info. For every access token starting with `hvo1/`
     * no information will be printed.
     *
     * @deprecated This option will be removed in the future.
     */
    printTokenInfo?: boolean;
    /**
     * Automatically dispose the client when the process is terminated
     *
     * Apollo: Enabled by default
     * Yoga / Envelop: Enabled by default for SIGINT and SIGTERM signals
     */
    autoDispose?: boolean | NodeJS.Signals[];
    /**
     * Persisted documents configuration.
     *
     **/
    persistedDocuments?: PersistedDocumentsConfiguration;
  },
  'enabled',
  'token'
>;

export type HiveInternalPluginOptions = HivePluginOptions & {
  logger: Logger;
};

export type Maybe<T> = null | undefined | T;

export type GraphQLResult<TData = Record<string, unknown>> = {
  data?: TData | null;
} & GraphQLErrorsResult;

export interface TrackedGraphQLError {
  coordinate: string;
  code?: string;
}

export interface GraphQLErrorsResult {
  errors?: ReadonlyArray<{
    message: string;
    path?: Maybe<ReadonlyArray<string | number>>;
    extensions?: GraphQLErrorExtensions;
  }>;
}

export interface SchemaFetcherOptions {
  endpoint: string;
  key: string;
  logger?: Logger;
  name?: string;
  version?: string;
}

export interface ServicesFetcherOptions {
  endpoint: string;
  key: string;
}

/**
 * A sentinel value used to indicate a document was looked up but not found.
 * This enables negative caching - caching the absence of a document to avoid
 * repeated CDN lookups for documents that don't exist.
 */
export const PERSISTED_DOCUMENT_NOT_FOUND = '__HIVE_PERSISTED_DOCUMENT_NOT_FOUND__' as const;
export type PersistedDocumentNotFound = typeof PERSISTED_DOCUMENT_NOT_FOUND;

/**
 * Layer 2 cache interface for persisted documents.
 * Implementers can use Redis, Memcached, or any other distributed cache.
 *
 * @example
 * ```typescript
 * import { createClient } from 'redis';
 * import { createHive} from '@graphql-hive/core';
 *
 * const redis = createClient({ url: 'redis://localhost:6379' });
 * await redis.connect();
 *
 * const cache: PersistedDocumentsCache = {
 *   async get(key) {
 *     return redis.get(`hive:pd:${key}`);
 *   },
 *   async set(key, value, options) {
 *     if (options?.ttl) {
 *       await redis.set(`hive:pd:${key}`, value, { EX: options.ttl });
 *     } else {
 *       await redis.set(`hive:pd:${key}`, value);
 *     }
 *   },
 * };
 * ```
 */
export type PersistedDocumentsCache = {
  /**
   * Get a document from the cache.
   * @param key - The document ID (e.g., "myapp~v1.0.0~abc123")
   * @returns The document body, PERSISTED_DOCUMENT_NOT_FOUND for negative cache hit, or null for cache miss
   */
  get(key: string): Promise<string | PersistedDocumentNotFound | null>;

  /**
   * Store a document in the cache.
   * Optional - if not provided, the cache is read-only.
   * @param key - The document ID
   * @param value - The document body or PERSISTED_DOCUMENT_NOT_FOUND for negative caching
   * @param options - Optional TTL configuration (ttl is in seconds)
   */
  set?(
    key: string,
    value: string | PersistedDocumentNotFound,
    options?: { ttl?: number },
  ): MaybePromise<unknown>;
};

/**
 * Configuration for the layer 2 cache.
 */
export type Layer2CacheConfiguration = {
  /**
   * The cache implementation (e.g., Redis client wrapper)
   */
  cache: PersistedDocumentsCache;

  /**
   * TTL in seconds for successfully found documents.
   * @default undefined (no expiration, or cache implementation default)
   */
  ttlSeconds?: number;

  /**
   * TTL in seconds for negative cache entries (document not found).
   * Set to 0 to disable negative caching.
   * @default 60 (1 minute)
   */
  notFoundTtlSeconds?: number;

  /**
   * Key prefix for cached persisted documents.
   * @default "" (no prefix)
   */
  keyPrefix?: string;

  /**
   * Optional function to register background work in serverless environments if not available in context.
   */
  waitUntil?: (promise: Promise<void> | void) => void;
};

export type PersistedDocumentsConfiguration = {
  /**
   * CDN configuration for loading persisted documents.
   **/
  cdn: {
    /**
     * CDN endpoint(s) for looking up persisted documents.
     *
     * It is possible to provide an endpoint list. The first endpoint will be treated as the primary source.
     * The secondary endpoint will be used in case the first endpoint fails to respond.
     *
     * @example
     * ```
     * [
     *          "https://cdn.graphql-hive.com/artifacts/v1/9fb37bc4-e520-4019-843a-0c8698c25688",
     *   "https://cdn-mirror.graphql-hive.com/artifacts/v1/9fb37bc4-e520-4019-843a-0c8698c25688"
     * ]
     * ```
     */
    endpoint: string | [string, string];
    /**
     * CDN access token
     * @example hv2ZjUxNGUzN2MtNjVhNS0=
     */
    accessToken: string;
  };
  /**
   * Whether arbitrary documents should be allowed along-side persisted documents.
   * @default false
   */
  allowArbitraryDocuments?: boolean | AllowArbitraryDocumentsFunction;
  /**
   * Maximum amount of operations that shall be kept in memory after being loaded from the CDN.
   * Operations are stored in-memory to avoid loading them from the CDN multiple times.
   * @default 10_000
   */
  cache?: number;
  /**
   * WHATWG Compatible fetch implementation
   * used for doing HTTP requests.
   */
  fetch?: typeof fetch;
  /** Configuration for the circuit breaker. */
  circuitBreaker?: CircuitBreakerConfiguration;
  /**
   * Optional layer 2 cache configuration.
   * When configured, the SDK will check this cache after the in-memory cache miss
   * and before making a CDN request.
   *
   * This is useful for distributed caching (e.g., Redis) in multi-instance deployments,
   * providing:
   * - Shared cache between gateway instances
   * - Additional resilience layer for CDN outages
   * - Faster response times after gateway restarts
   *
   * @example
   * ```typescript
   * import { createClient } from 'redis';
   * import { createHive} from '@graphql-hive/core';
   *
   * const redis = createClient({ url: 'redis://localhost:6379' });
   * await redis.connect();
   *
   * const hive = createHive({
   *   persistedDocuments: {
   *     cdn: { endpoint: '...', accessToken: '...' },
   *     layer2Cache: {
   *       cache: {
   *         get: (key) => redis.get(`hive:pd:${key}`),
   *         set: (key, value, opts) =>
   *           redis.set(`hive:pd:${key}`, value, opts?.ttl ? { EX: opts.ttl } : {}),
   *       },
   *       ttlSeconds: 3600,        // 1 hour for found documents
   *       notFoundTtlSeconds: 60,  // 1 minute for notfound entries
   *     },
   *   },
   * });
   * ```
   */
  layer2Cache?: Layer2CacheConfiguration;
};

export type AllowArbitraryDocumentsFunction = (context: {
  /** an object for accessing the request headers. */
  headers?: HeadersObject;
}) => PromiseOrValue<boolean>;
