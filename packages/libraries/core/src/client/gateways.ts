import { version } from '../version.js';
import { http } from './http-client.js';
import type { SchemaFetcherOptions, ServicesFetcherOptions } from './types.js';
import { createHash, joinUrl } from './utils.js';

interface Schema {
  sdl: string;
  url: string | null;
  name: string;
}

function createFetcher(options: SchemaFetcherOptions & ServicesFetcherOptions) {
  let cacheETag: string | null = null;
  let cached: {
    id: string;
    supergraphSdl: string;
  } | null = null;

  const endpoint = options.endpoint.endsWith('/services')
    ? options.endpoint
    : joinUrl(options.endpoint, 'services');

  return function fetcher(): Promise<readonly Schema[] | Schema> {
    const headers: {
      [key: string]: string;
    } = {
      'X-Hive-CDN-Key': options.key,
      accept: 'application/json',
      'User-Agent': `hive-client/${version}`,
    };

    if (cacheETag) {
      headers['If-None-Match'] = cacheETag;
    }

    return http
      .get(endpoint, {
        headers,
        retry: {
          retryWhen: response => response.status >= 500,
          okWhen: response => response.status === 304,
          retries: 10,
          maxTimeout: 200,
          minTimeout: 1,
        },
      })
      .then(async response => {
        if (response.ok) {
          const result = await response.json();

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

export function createSchemaFetcher(options: SchemaFetcherOptions) {
  const fetcher = createFetcher(options);

  return function schemaFetcher() {
    return fetcher().then(schema => {
      let service: Schema;
      // Before the new artifacts endpoint the body returned an array or a single object depending on the project type.
      // This handles both in a backwards-compatible way.
      if (schema instanceof Array) {
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

export function createServicesFetcher(options: ServicesFetcherOptions) {
  const fetcher = createFetcher(options);

  return function schemaFetcher() {
    return fetcher().then(async services => {
      if (services instanceof Array) {
        return Promise.all(
          services.map(service => createSchemaId(service).then(id => ({ id, ...service }))),
        );
      }
      throw new Error(
        'Encountered a single service instead of a multiple services. Please use createSchemaFetcher instead.',
      );
    });
  };
}

const createSchemaId = (service: Schema) =>
  createHash('SHA-256')
    .update(service.sdl)
    .update(service.url || '')
    .update(service.name)
    .digest('base64');
