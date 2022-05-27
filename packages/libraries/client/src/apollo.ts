import type { ApolloServerPlugin } from 'apollo-server-plugin-base';
import type { DocumentNode } from 'graphql';
import type { HiveClient, HivePluginOptions, SupergraphSDLFetcherOptions } from './internal/types';
import { createHash } from 'node:crypto';
import axios from 'axios';
import { createHive } from './client';
import { isHiveClient } from './internal/utils';

export function createSupergraphSDLFetcher({ endpoint, key }: SupergraphSDLFetcherOptions) {
  return function supergraphSDLFetcher() {
    return axios
      .get(endpoint + '/supergraph', {
        headers: {
          'X-Hive-CDN-Key': key,
        },
      })
      .then(response => {
        if (response.status >= 200 && response.status < 300) {
          return response.data;
        }

        return Promise.reject(new Error(`Failed to fetch supergraph [${response.status}]`));
      })
      .then(supergraphSdl => ({
        id: createHash('sha256').update(supergraphSdl).digest('base64'),
        supergraphSdl,
      }));
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

  hive.info();

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
