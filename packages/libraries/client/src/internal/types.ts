import type { ExecutionArgs } from 'graphql';
import type { AgentOptions } from './agent.js';
import type { OperationsStore } from './operations-store.js';
import type { SchemaReporter } from './reporting.js';

export interface HiveClient {
  info(): Promise<void>;
  reportSchema: SchemaReporter['report'];
  collectUsage(): CollectUsageCallback;
  /**
   * @deprecated https://github.com/kamilkisiela/graphql-hive/issues/659
   */
  operationsStore: OperationsStore;
  dispose(): Promise<void>;
}

export type AsyncIterableIteratorOrValue<T> = AsyncIterableIterator<T> | T;
export type AsyncIterableOrValue<T> = AsyncIterable<T> | T;
export type AbortAction = {
  action: 'abort';
  reason: string;
  logging: boolean;
};

export type CollectUsageCallback = (
  args: ExecutionArgs,
  result:
    | AsyncIterableIteratorOrValue<GraphQLErrorsResult>
    | AsyncIterableOrValue<GraphQLErrorsResult>
    | AbortAction,
) => void;
export interface ClientInfo {
  name: string;
  version: string;
}

export interface Logger {
  info(msg: string): void;
  error(error: any, ...data: any[]): void;
}

export interface HiveUsagePluginOptions {
  /**
   * Custom endpoint to collect schema usage
   *
   * @deprecated use `options.selfHosted.usageEndpoint` instead
   *
   * Points to Hive by default
   */
  endpoint?: string;
  /**
   * Extract client info from GraphQL Context
   */
  clientInfo?(context: any): null | undefined | ClientInfo;
  /**
   * Generate hash of an operation (useful for persisted operations)
   */
  operationHash?(args: ExecutionArgs): string | null | undefined;
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
   * A list of operations (by name) to be ignored by Hive.
   */
  exclude?: string[];
  /**
   * Sample rate to determine sampling.
   * 0.0 = 0% chance of being sent
   * 1.0 = 100% chance of being sent.
   *
   * Default: 1.0
   */
  sampleRate?: number;
  /**
   * (Experimental) Enables collecting Input fields usage based on the variables passed to the operation.
   *
   * Default: false
   */
  processVariables?: boolean;
}

export interface HiveReportingPluginOptions {
  /**
   * Custom endpoint to collect schema reports
   *
   * @deprecated use `options.selfHosted.usageEndpoint` instead
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

export interface HiveOperationsStorePluginOptions {
  /**
   * Custom endpoint to fetch stored operations
   *
   * Points to Hive by default
   */
  endpoint?: string;
}

export interface HiveSelfHostingOptions {
  /**
   * Point to your own instance of GraphQL Hive API
   *
   * Used by schema reporting and token info.
   */
  graphqlEndpoint: string;
  /**
   * Address of your own GraphQL Hive application
   *
   * Used by token info to generate a link to the organization, project and target.
   */
  applicationUrl: string;
  /**
   * Point to your own instance of GraphQL Hive Usage API
   *
   * Used by usage reporting
   */
  usageEndpoint?: string;
}

type OptionalWhenFalse<T, KCond extends keyof T, KExcluded extends keyof T> =
  // untouched by default or when true
  | T
  // when false, make KExcluded optional
  | (Omit<T, KExcluded> & { [P in KCond]: false } & { [P in KExcluded]?: T[KExcluded] });

export type HivePluginOptions = OptionalWhenFalse<
  {
    /**
     * Enable/Disable Hive
     *
     * Default: true
     */
    enabled?: boolean;
    /**
     * Debugging mode
     *
     * Default: false
     */
    debug?: boolean;
    /**
     * Access Token
     */
    token: string;
    /**
     * Use when self-hosting GraphQL Hive
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
     */
    reporting?: HiveReportingPluginOptions | false;
    /**
     * Operations Store
     */
    operationsStore?: HiveOperationsStorePluginOptions;
  },
  'enabled',
  'token'
>;

export type Maybe<T> = null | undefined | T;

export interface GraphQLErrorsResult {
  errors?: ReadonlyArray<{
    message: string;
    path?: Maybe<ReadonlyArray<string | number>>;
  }>;
}

export interface SupergraphSDLFetcherOptions {
  endpoint: string;
  key: string;
}

export interface SchemaFetcherOptions {
  endpoint: string;
  key: string;
}

export interface ServicesFetcherOptions {
  endpoint: string;
  key: string;
}
