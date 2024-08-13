import { version } from '../version.js';
import { http } from './http-client.js';
import type { Logger } from './types.js';
import { createHash, joinUrl } from './utils.js';

export interface SupergraphSDLFetcherOptions {
  endpoint: string;
  key: string;
  logger?: Logger;
}

export function createSupergraphSDLFetcher(options: SupergraphSDLFetcherOptions) {
  let cacheETag: string | null = null;
  let cached: {
    id: string;
    supergraphSdl: string;
  } | null = null;
  const endpoint = options.endpoint.endsWith('/supergraph')
    ? options.endpoint
    : joinUrl(options.endpoint, 'supergraph');

  return function supergraphSDLFetcher(): Promise<{ id: string; supergraphSdl: string }> {
    const headers: {
      [key: string]: string;
    } = {
      'X-Hive-CDN-Key': options.key,
      'User-Agent': `hive-client/${version}`,
    };

    if (cacheETag) {
      headers['If-None-Match'] = cacheETag;
    }

    return http
      .get(endpoint, {
        headers,
        isRequestOk: response => response.status === 304 || response.ok,
        retry: {
          retries: 10,
          maxTimeout: 200,
          minTimeout: 1,
        },
        logger: options.logger,
      })
      .then(async response => {
        if (response.ok) {
          const supergraphSdl = await response.text();
          const result = {
            id: await createHash('SHA-256').update(supergraphSdl).digest('base64'),
            supergraphSdl,
          };

          const etag = response.headers.get('etag');
          if (etag) {
            cached = result;
            cacheETag = etag;
          }

          return result;
        }

        if (response.status === 304 && cached !== null) {
          return cached;
        }

        throw new Error(
          `Failed to GET ${endpoint}, received: ${response.status} ${response.statusText ?? 'Internal Server Error'}`,
        );
      });
  };
}
