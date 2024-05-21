import { GraphQLError, type DocumentNode } from 'graphql';
import type { ApolloServerPlugin, HTTPGraphQLRequest } from '@apollo/server';
import {
  autoDisposeSymbol,
  createHash,
  createHive as createHiveClient,
  HiveClient,
  HivePluginOptions,
  http,
  isHiveClient,
  joinUrl,
} from '@graphql-hive/core';
import { version } from './version.js';

export { atLeastOnceSampler, createSchemaFetcher, createServicesFetcher } from '@graphql-hive/core';

export interface SupergraphSDLFetcherOptions {
  endpoint: string;
  key: string;
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

  return function supergraphSDLFetcher() {
    const headers: {
      [key: string]: string;
    } = {
      'X-Hive-CDN-Key': options.key,
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

    const fetchWithRetry = (): Promise<{ id: string; supergraphSdl: string }> => {
      return http
        .get(endpoint, {
          headers,
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

          return retry(response.status);
        });
    };

    return fetchWithRetry();
  };
}

export function createSupergraphManager(
  options: { pollIntervalInMs?: number } & SupergraphSDLFetcherOptions,
) {
  const pollIntervalInMs = options.pollIntervalInMs ?? 30_000;
  const fetchSupergraph = createSupergraphSDLFetcher({
    endpoint: options.endpoint,
    key: options.key,
  });
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
            console.error(
              `Failed to update supergraph: ${error instanceof Error ? error.message : error}`,
            );
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

function addRequestWithHeaders(context: any, http?: HTTPGraphQLRequest) {
  if (!!http && !('request' in context)) {
    context.request = {
      headers: http.headers,
    };
  }

  return context;
}

export function createHive(clientOrOptions: HivePluginOptions) {
  return createHiveClient({
    ...clientOrOptions,
    agent: {
      name: 'hive-client-yoga',
      ...clientOrOptions.agent,
    },
  });
}

export function useHive(clientOrOptions: HiveClient | HivePluginOptions): ApolloServerPlugin {
  const hive = isHiveClient(clientOrOptions) ? clientOrOptions : createHive(clientOrOptions);

  void hive.info();

  return {
    async requestDidStart(context) {
      // `overallCachePolicy` does not exist in v0
      const isLegacyV0 = !('overallCachePolicy' in context);
      // `context` does not exist in v4, it is `contextValue` instead
      const isLegacyV3 = 'context' in context;

      let doc: DocumentNode;
      let didResolveSource = false;
      const complete = hive.collectUsage();
      const args = {
        schema: context.schema,
        get document() {
          return doc;
        },
        operationName: context.operationName,
        contextValue: addRequestWithHeaders(
          isLegacyV3 ? context.context : context.contextValue,
          context.request?.http,
        ),
        variableValues: context.request.variables,
      };

      let persistedDocumentError: GraphQLError | null = null;

      if (hive.persistedDocuments) {
        if (
          context.request.http?.body &&
          typeof context.request.http.body === 'object' &&
          'documentId' in context.request.http.body &&
          typeof context.request.http.body.documentId === 'string'
        ) {
          const document = await hive.persistedDocuments.resolve(
            context.request.http.body.documentId,
          );

          if (document) {
            context.request.query = document;
          } else {
            context.request.query = '{__typename}';
            persistedDocumentError = new GraphQLError('Persisted document not found.', {
              extensions: {
                code: 'PERSISTED_DOCUMENT_NOT_FOUND',
                http: {
                  status: 400,
                },
              },
            });
          }
        } else if (
          false ===
          (await hive.persistedDocuments.allowArbitraryDocuments({
            headers: {
              get(name: string) {
                return context.request.http?.headers?.get(name) ?? null;
              },
            },
          }))
        ) {
          context.request.query = '{__typename}';
          persistedDocumentError = new GraphQLError('No persisted document provided.', {
            extensions: {
              code: 'PERSISTED_DOCUMENT_REQUIRED',
              http: {
                status: 400,
              },
            },
          });
        }
      }

      if (isLegacyV0) {
        return {
          didResolveSource() {
            didResolveSource = true;
          },
          willSendResponse(ctx: any) {
            if (!didResolveSource) {
              void complete(args, {
                action: 'abort',
                reason: 'Did not resolve source',
                logging: false,
              });
              return;
            }
            doc = ctx.document;
            void complete(args, ctx.response);
          },
        } as any;
      }

      if (isLegacyV3) {
        return Promise.resolve({
          didResolveSource() {
            didResolveSource = true;
          },
          async willSendResponse(ctx) {
            if (!didResolveSource) {
              void complete(args, {
                action: 'abort',
                reason: 'Did not resolve source',
                logging: false,
              });
              return;
            }

            if (!ctx.document) {
              const details = ctx.operationName ? `operationName: ${ctx.operationName}` : '';
              void complete(args, {
                action: 'abort',
                reason: 'Document is not available' + (details ? ` (${details})` : ''),
                logging: true,
              });
              return;
            }

            doc = ctx.document!;
            void complete(args, ctx.response as any);
          },
        });
      }

      let didFailValidation = false;

      // v4
      return Promise.resolve({
        didResolveSource() {
          didResolveSource = true;
        },
        async validationDidStart() {
          return function onErrors(errors) {
            if (errors?.length) {
              didFailValidation = true;
            }
          };
        },
        didResolveOperation() {
          if (persistedDocumentError) {
            throw persistedDocumentError;
          }
        },
        async willSendResponse(ctx) {
          if (didFailValidation) {
            void complete(args, {
              action: 'abort',
              reason: 'Validation failed',
              logging: false,
            });
            return;
          }
          if (!didResolveSource) {
            void complete(args, {
              action: 'abort',
              reason: 'Did not resolve source',
              logging: false,
            });
            return;
          }

          if (!ctx.document) {
            const details = ctx.operationName ? `operationName: ${ctx.operationName}` : '';
            void complete(args, {
              action: 'abort',
              reason: 'Document is not available' + (details ? ` (${details})` : ''),
              logging: true,
            });
            return;
          }

          doc = ctx.document;
          if (ctx.response.body.kind === 'incremental') {
            void complete(args, {
              action: 'abort',
              reason: '@defer and @stream is not supported by Hive',
              logging: true,
            });
          } else {
            void complete(args, ctx.response.body.singleResult);
          }
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
            if (hive[autoDisposeSymbol]) {
              await hive.dispose();
            }
          },
        } as any;
      }

      // Works on v3 and v4

      return Promise.resolve({
        async serverWillStop() {
          if (hive[autoDisposeSymbol]) {
            await hive.dispose();
          }
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
