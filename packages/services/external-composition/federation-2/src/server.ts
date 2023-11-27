import { parse, printSchema } from 'graphql';
import LRU from 'lru-cache';
import { composeServices } from '@apollo/composition';
import { Supergraph } from '@apollo/federation-internals';
import { compose, signatureHeaderName, verifyRequest } from '@graphql-hive/external-composition';
import { Response } from '@whatwg-node/fetch';
import { createServerAdapter } from '@whatwg-node/server';
import { ResolvedEnv } from './environment';

const cache = new LRU<string, Promise<string>>({
  max: 20,
  allowStale: true,
});

const composeFederation = compose(services => {
  try {
    const result = composeServices(
      services.map(service => {
        return {
          typeDefs: parse(service.sdl),
          name: service.name,
          url: service.url,
        };
      }),
    );

    if (result.errors?.length) {
      return {
        type: 'failure',
        result: {
          errors: result.errors.map(error => ({
            message: error.message,
            source:
              typeof error.extensions?.code === 'string' &&
              // `INVALID_GRAPHQL` is a special error code that is used to indicate that the error comes from GraphQL-JS
              error.extensions.code !== 'INVALID_GRAPHQL'
                ? 'composition'
                : 'graphql',
          })),
        },
      };
    }

    if (!result.supergraphSdl) {
      return {
        type: 'failure',
        result: {
          errors: [
            {
              message: 'supergraphSdl not defined',
              source: 'graphql',
            },
          ],
        },
      };
    }

    const apiSchema = Supergraph.build(result.supergraphSdl).apiSchema().toGraphQLJSSchema();

    return {
      type: 'success',
      result: {
        supergraph: result.supergraphSdl,
        sdl: printSchema(apiSchema),
      },
    };
  } catch (e) {
    return {
      type: 'failure',
      result: {
        errors: [
          {
            message: (e as Error).message,
            source: 'graphql',
          },
        ],
      },
    };
  }
});

async function composeFederationFromBody(body: string) {
  return JSON.stringify(composeFederation(JSON.parse(body)));
}

async function composeFederationWithCache(body: string, signature: string) {
  const cachedResult = cache.get(signature);

  if (cachedResult) {
    return cachedResult;
  }

  const value = composeFederationFromBody(body);

  cache.set(signature, value);
  return value;
}

export const createRequestListener = (env: ResolvedEnv): ReturnType<typeof createServerAdapter> =>
  createServerAdapter(async request => {
    const url = new URL(request.url);
    const httpRequestId = request.headers.get('x-hive-request-id');
    const httpRequestDetails =
      `[${request.method}] ${url.pathname}` + (httpRequestId ? ` (${httpRequestId})` : '');
    console.log(`${httpRequestDetails} - start`);

    if (url.pathname === '/_readiness') {
      return new Response('Ok.', {
        status: 200,
      });
    }

    if (request.method === 'POST' && url.pathname === '/compose') {
      const signatureHeaderValue = request.headers.get(signatureHeaderName);
      if (signatureHeaderValue === null) {
        return new Response(`Missing signature header '${signatureHeaderName}'.`, { status: 400 });
      }

      const body = await request.text().catch(error => {
        console.error(error);
        console.log(`${httpRequestDetails} - 500`);
        return Promise.reject(error);
      });

      const error = verifyRequest({
        // Stringified body, or raw body if you have access to it
        body,
        // Pass here the signature from `X-Hive-Signature-256` header
        signature: signatureHeaderValue,
        // Pass here the secret you configured in GraphQL Hive
        secret: env.secret,
      });

      if (error) {
        console.log(`${httpRequestDetails} - 500`);
        return new Response(error, { status: 500 });
      }

      const result = await composeFederationWithCache(body, signatureHeaderValue);

      console.log(`${httpRequestDetails} - 200`);
      return new Response(result, {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      });
    }

    console.log(`${httpRequestDetails} - 404`);
    return new Response('Route not found', {
      status: 404,
    });
  });
