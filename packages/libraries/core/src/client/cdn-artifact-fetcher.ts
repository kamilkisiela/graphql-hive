import { Logger } from '@graphql-hive/logger';
import CircuitBreaker from '../circuit-breaker/circuit.js';
import { version } from '../version.js';
import {
  CircuitBreakerConfiguration,
  defaultCircuitBreakerConfiguration,
} from './circuit-breaker.js';
import { http, HttpCallConfig } from './http-client.js';
import { chooseLogger, createHash } from './utils.js';

type CreateCDNArtifactFetcherArgs = {
  /**
   * The endpoint that should be fetched.
   *
   * It is possible to provide an endpoint list. The first endpoint will be treated as the primary source.
   * The secondary endpoint will be used in case the first endpoint fails to respond.
   *
   * Example:
   *
   * ```
   * [
   *          "https://cdn.graphql-hive.com/artifacts/v1/9fb37bc4-e520-4019-843a-0c8698c25688/supergraph",
   *   "https://cdn-mirror.graphql-hive.com/artifacts/v1/9fb37bc4-e520-4019-843a-0c8698c25688/supergraph"
   * ]
   * ```
   */
  endpoint: string | [string, string];
  /**
   * The access key that is used for authenticating on the endpoints (via the `X-Hive-CDN-Key` header).
   */
  accessKey: string;
  logger?: Logger;
  circuitBreaker?: CircuitBreakerConfiguration;
  /**
   * Custom fetch implementation used for calling the endpoint.
   */
  fetch?: typeof fetch;
  /** Amount of retries per endpoint lookup attempt */
  retry?: HttpCallConfig['retry'];
  /** Timeout per retry for endpoint lookup */
  timeout?: HttpCallConfig['timeout'];
  /**
   * Optional client meta configuration.
   **/
  client?: {
    name: string;
    version: string;
  };
};

type CDNFetchResult = {
  /** Text contents of the artifact */
  contents: string;
  /** SHA-256 Hash */
  hash: string;
  /** Schema Version ID as on Hive Console (optional)
   * @deprecated Please us `graphVersionId` instead.
   */
  schemaVersionId: null | string;
  /** The graph id of the artifact. */
  graphVersionId: null | string;
  /** The graph id of the artifact. */
  graphId: null | string;
  /** When the artifact was last modified. */
  lastModified: null | string;
};

function isRequestOk(response: Response) {
  return response.status === 304 || response.ok;
}

export type CDNArtifactFetcher = {
  /** Call the CDN and retrieve the lastest artifact version. */
  fetch(): Promise<CDNFetchResult>;
  /** Dispose the fetcher and cleanup existing timers (e.g. used for circuit breaker) */
  dispose(): void;
};

/**
 * Create a handler for fetching a CDN artifact with built-in cache and circuit breaker.
 * It is intended for polling supergraph, schema sdl or services.
 */
export function createCDNArtifactFetcher(args: CreateCDNArtifactFetcherArgs): CDNArtifactFetcher {
  const logger = chooseLogger(args.logger);
  let cacheETag: string | null = null;
  let cached: CDNFetchResult | null = null;
  const clientInfo = args.client ?? { name: 'hive-client', version };
  const circuitBreakerConfig = args.circuitBreaker ?? defaultCircuitBreakerConfiguration;
  const endpoints = Array.isArray(args.endpoint) ? args.endpoint : [args.endpoint];

  function runFetch(circuitBreaker: CircuitBreaker, endpoint: string) {
    const signal = circuitBreaker.getSignal();
    const headers: {
      [key: string]: string;
    } = {
      'X-Hive-CDN-Key': args.accessKey,
      'User-Agent': `${clientInfo.name}/${clientInfo.version}`,
    };

    if (cacheETag) {
      headers['If-None-Match'] = cacheETag;
    }

    return http.get(endpoint, {
      headers,
      isRequestOk,
      retry: args.retry ?? {
        retries: 10,
        maxTimeout: 200,
        minTimeout: 1,
      },
      timeout: args.timeout,
      logger,
      fetchImplementation: args.fetch,
      signal,
    });
  }

  const circuitBreakers = endpoints.map(endpoint => {
    const circuitBreaker = new CircuitBreaker(
      async function fire() {
        return await runFetch(circuitBreaker, endpoint);
      },
      {
        ...circuitBreakerConfig,
        timeout: false,
        autoRenewAbortController: true,
      },
    );
    return circuitBreaker;
  });

  async function attempt(breaker: CircuitBreaker) {
    const response: Response = await breaker.fire();

    if (response.status === 304) {
      if (cached !== null) {
        return cached;
      }
      throw new Error('Unexpected 304 with no cache');
    }

    const contents = await response.text();
    const graphVersionId =
      response.headers.get('x-hive-graph-version-id') ??
      response.headers.get('x-hive-schema-version-id') ??
      null;
    const graphId = response.headers.get('x-hive-graph-id') ?? null;
    const lastModified = response.headers.get('last-modified') ?? null;

    const result: CDNFetchResult = {
      hash: await createHash('SHA-256').update(contents).digest('base64'),
      contents,
      schemaVersionId: graphVersionId,
      graphVersionId,
      graphId,
      lastModified,
    };

    const etag = response.headers.get('etag');
    if (etag) {
      cached = result;
      cacheETag = etag;
    }

    return result;
  }

  return {
    async fetch(): Promise<CDNFetchResult> {
      for (const [index, breaker] of circuitBreakers.entries()) {
        try {
          return await attempt(breaker);
        } catch (error: unknown) {
          logger.debug({ error });
          if (index === circuitBreakers.length - 1) {
            if (cached) {
              return cached;
            }
          }
        }
      }
      throw new Error('Could not retrieve artifact.');
    },
    dispose() {
      circuitBreakers.forEach(breaker => breaker.shutdown());
    },
  };
}
