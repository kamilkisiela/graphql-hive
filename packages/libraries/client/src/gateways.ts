import axios from 'axios';
import { createHash } from 'node:crypto';
import type { SchemaFetcherOptions, ServicesFetcherOptions } from './internal/types';

interface Schema {
  sdl: string;
  url: string;
  name: string;
}

function createFetcher<T>({ endpoint, key }: SchemaFetcherOptions & ServicesFetcherOptions) {
  return function fetcher(): Promise<T> {
    return axios
      .get(endpoint + '/schema', {
        headers: {
          'X-Hive-CDN-Key': key,
          accept: 'application/json',
        },
        responseType: 'json',
      })
      .then(response => {
        if (response.status >= 200 && response.status < 300) {
          return response.data;
        }

        return Promise.reject(new Error(`Failed to fetch [${response.status}]`));
      });
  };
}

export function createSchemaFetcher({ endpoint, key }: SchemaFetcherOptions) {
  const fetcher = createFetcher<Schema>({ endpoint, key });

  return function schemaFetcher() {
    return fetcher().then(schema => ({
      id: createHash('sha256').update(schema.sdl).update(schema.url).update(schema.name).digest('base64'),
      ...schema,
    }));
  };
}

export function createServicesFetcher({ endpoint, key }: ServicesFetcherOptions) {
  const fetcher = createFetcher<readonly Schema[]>({ endpoint, key });

  return function schemaFetcher() {
    return fetcher().then(services =>
      services.map(service => ({
        id: createHash('sha256').update(service.sdl).update(service.url).update(service.name).digest('base64'),
        ...service,
      }))
    );
  };
}
