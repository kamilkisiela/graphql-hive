import { createHash } from 'crypto';
import axios from 'axios';
import type { SchemaFetcherOptions, ServicesFetcherOptions } from './internal/types.js';
import { version } from './version.js';

interface Schema {
  sdl: string;
  url: string | null;
  name: string;
}

function createFetcher({ endpoint, key }: SchemaFetcherOptions & ServicesFetcherOptions) {
  let cacheETag: string | null = null;
  let cached: {
    id: string;
    supergraphSdl: string;
  } | null = null;

  return function fetcher(): Promise<readonly Schema[] | Schema> {
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

    let retryCount = 0;

    const retry = (status: number) => {
      if (retryCount >= 10 || status < 499) {
        return Promise.reject(new Error(`Failed to fetch [${status}]`));
      }

      retryCount = retryCount + 1;

      return fetchWithRetry();
    };

    const fetchWithRetry = (): Promise<readonly Schema[] | Schema> => {
      return axios
        .get(endpoint + '/services', {
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

          return retry(response.status);
        })
        .catch(async error => {
          if (axios.isAxiosError(error)) {
            if (error.response?.status === 304 && cached !== null) {
              return cached;
            }

            if (error.response?.status) {
              return retry(error.response.status);
            }
          }

          throw error;
        });
    };

    return fetchWithRetry();
  };
}

export function createSchemaFetcher({ endpoint, key }: SchemaFetcherOptions) {
  const fetcher = createFetcher({ endpoint, key });

  return function schemaFetcher() {
    return fetcher().then(schema => {
      let service: Schema;
      // Before the new artifacts endpoint the body returned an array or a single object depending on the project type.
      // This handles both in a backwards-compatible way.
      if (Array.isArray(schema)) {
        if (schema.length !== 1) {
          throw new Error(
            'Encountered multiple services instead of a single service. Please use createServicesFetcher instead.',
          );
        }
        service = schema[0];
      } else {
        service = schema;
      }

      return {
        id: createSchemaId(service),
        ...service,
      };
    });
  };
}

export function createServicesFetcher({ endpoint, key }: ServicesFetcherOptions) {
  const fetcher = createFetcher({ endpoint, key });

  return function schemaFetcher() {
    return fetcher().then(services => {
      if (Array.isArray(services)) {
        return services.map(service => ({
          id: createSchemaId(service),
          ...service,
        }));
      }
      throw new Error(
        'Encountered a single service instead of a multiple services. Please use createSchemaFetcher instead.',
      );
    });
  };
}

const createSchemaId = (service: Schema) =>
  createHash('sha256')
    .update(service.sdl)
    .update(service.url || '')
    .update(service.name)
    .digest('base64');
