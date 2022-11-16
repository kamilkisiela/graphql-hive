import type { ApolloServerPlugin } from 'apollo-server-plugin-base';
import type { DocumentNode } from 'graphql';
import type { HiveClient, HivePluginOptions, SupergraphSDLFetcherOptions } from './internal/types';
import { createHash } from 'crypto';
import axios from 'axios';
import { createHive } from './client';
import { isHiveClient } from './internal/utils';
import { version } from './version';

export function createSupergraphSDLFetcher({ endpoint, key }: SupergraphSDLFetcherOptions) {
  let cacheETag: string | null = null;
  let cached: {
    id: string;
    supergraphSdl: string;
  } | null = null;

  return function supergraphSDLFetcher() {
    const headers: {
      [key: string]: string;
    } = {
      'X-Hive-CDN-Key': key,
      'user-agent': `hive-client/${version}`,
    };

    if (cacheETag) {
      headers['If-None-Match'] = cacheETag;
    }

    return axios
      .get(endpoint + '/supergraph', {
        headers,
      })
      .then(response => {
        if (response.status >= 200 && response.status < 300) {
          const supergraphSdl = response.data;
          const result = {
            id: createHash('sha256').update(supergraphSdl).digest('base64'),
            supergraphSdl,
          };

          const etag = response.headers['etag'];
          if (etag) {
            cached = result;
            cacheETag = etag;
          }

          return result;
        }

        return Promise.reject(new Error(`Failed to fetch supergraph [${response.status}]`));
      })
      .catch(async error => {
        if (axios.isAxiosError(error) && error.response?.status === 304 && cached !== null) {
          return cached;
        }

        throw error;
      });
  };
}

export function createSupergraphManager(options: { pollIntervalInMs?: number } & SupergraphSDLFetcherOptions) {
  const pollIntervalInMs = options.pollIntervalInMs ?? 30_000;
  const fetchSupergraph = createSupergraphSDLFetcher({ endpoint: options.endpoint, key: options.key });
  let timer: ReturnType<typeof setTimeout> | null = null;

  return {
    async initialize(hooks: { update(supergraphSdl: string): void }): Promise<{
      supergraphSdl: string;
      cleanup?: () => Promise<void>;
    }> {
      const initialResult = await fetchSupergraph();

      function poll() {
        timer = setTimeout(async () => {
          try {
            const result = await fetchSupergraph();
            if (result.supergraphSdl) {
              hooks.update?.(result.supergraphSdl);
            }
          } catch (error) {
            console.error(`Failed to update supergraph: ${error instanceof Error ? error.message : error}`);
          }
          poll();
        }, pollIntervalInMs);
      }

      poll();

      return {
        supergraphSdl: initialResult.supergraphSdl,
        cleanup: async () => {
          if (timer) {
            clearTimeout(timer);
          }
        },
      };
    },
  };
}

export function hiveApollo(clientOrOptions: HiveClient | HivePluginOptions): ApolloServerPlugin {
  const hive = isHiveClient(clientOrOptions)
    ? clientOrOptions
    : createHive({
        ...clientOrOptions,
        agent: {
          name: 'HiveApollo',
          ...(clientOrOptions.agent ?? {}),
        },
      });

  void hive.info();

  return {
    requestDidStart(context) {
      // `overallCachePolicy` does not exist in v0
      const isLegacyV0 = !('overallCachePolicy' in context);

      let doc: DocumentNode;
      const complete = hive.collectUsage({
        schema: context.schema,
        get document() {
          return doc;
        },
        operationName: context.operationName,
        contextValue: context.context,
        variableValues: context.request.variables,
      });

      if (isLegacyV0) {
        return {
          willSendResponse(ctx: any) {
            doc = ctx.document;
            complete(ctx.response);
          },
        } as any;
      }

      return Promise.resolve({
        async willSendResponse(ctx) {
          doc = ctx.document!;
          complete(ctx.response);
        },
      });
    },
    serverWillStart(ctx) {
      // `engine` does not exist in v3
      const isLegacyV0 = 'engine' in ctx;

      hive.reportSchema({ schema: ctx.schema });

      if (isLegacyV0) {
        return {
          async serverWillStop() {
            await hive.dispose();
          },
        } as any;
      }

      return Promise.resolve({
        async serverWillStop() {
          await hive.dispose();
        },
        schemaDidLoadOrUpdate(schemaContext) {
          if (ctx.schema !== schemaContext.apiSchema) {
            hive.reportSchema({ schema: schemaContext.apiSchema });
          }
        },
      });
    },
  };
}
