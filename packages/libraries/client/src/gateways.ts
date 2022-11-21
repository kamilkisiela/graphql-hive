import axios from 'axios';
import { createHash } from 'crypto';
import type { SchemaFetcherOptions, ServicesFetcherOptions } from './internal/types';
import { version } from './version';

interface Schema {
  sdl: string;
  url: string | null;
  name: string;
}

function createFetcher<T>({ endpoint, key }: SchemaFetcherOptions & ServicesFetcherOptions) {
  let cacheETag: string | null = null;
  let cached: {
    id: string;
    supergraphSdl: string;
  } | null = null;

  return function fetcher(): Promise<T> {
    const headers: {
      [key: string]: string;
    } = {
      'X-Hive-CDN-Key': key,
      accept: 'application/json',
      'User-Agent': `hive-client/${version}`,
    };

    if (cacheETag) {
      headers['If-None-Match'] = cacheETag;
    }

    return axios
      .get(endpoint + '/schema', {
        headers,
        responseType: 'json',
      })
      .then(response => {
        if (response.status >= 200 && response.status < 300) {
          const result = response.data;

          const etag = response.headers['etag'];
          if (etag) {
            cached = result;
            cacheETag = etag;
          }

          return result;
        }

        return Promise.reject(new Error(`Failed to fetch [${response.status}]`));
      })
      .catch(async error => {
        if (axios.isAxiosError(error) && error.response?.status === 304 && cached !== null) {
          return cached;
        }

        throw error;
      });
  };
}

export function createSchemaFetcher({ endpoint, key }: SchemaFetcherOptions) {
  const fetcher = createFetcher<Schema>({ endpoint, key });

  return function schemaFetcher() {
    return fetcher().then(schema => ({
      id: createHash('sha256')
        .update(schema.sdl)
        .update(schema.url || '')
        .update(schema.name)
        .digest('base64'),
      ...schema,
    }));
  };
}

export function createServicesFetcher({ endpoint, key }: ServicesFetcherOptions) {
  const fetcher = createFetcher<readonly Schema[]>({ endpoint, key });

  return function schemaFetcher() {
    return fetcher().then(services =>
      services.map(service => ({
        id: createHash('sha256')
          .update(service.sdl)
          .update(service.url || '')
          .update(service.name)
          .digest('base64'),
        ...service,
      }))
    );
  };
}
