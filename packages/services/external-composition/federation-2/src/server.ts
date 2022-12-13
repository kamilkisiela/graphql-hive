import { verifyRequest, compose, signatureHeaderName } from '@graphql-hive/external-composition';
import { composeServices } from '@apollo/composition';
import { parse, printSchema } from 'graphql';
import { createServerAdapter } from '@whatwg-node/server';
import { Response } from '@whatwg-node/fetch';
import { ResolvedEnv } from './environment';

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
          })),
        },
      };
    } else {
      if (!result.supergraphSdl) {
        return {
          type: 'failure',
          result: {
            errors: [{ message: 'supergraphSdl not defined' }],
          },
        };
      }

      return {
        type: 'success',
        result: {
          supergraph: result.supergraphSdl,
          sdl: printSchema(result.schema.toGraphQLJSSchema()),
        },
      };
    }
  } catch (e) {
    return {
      type: 'failure',
      result: {
        errors: [
          {
            message: (e as Error).message,
          },
        ],
      },
    };
  }
});

export const createRequestListener = (env: ResolvedEnv): ReturnType<typeof createServerAdapter> =>
  createServerAdapter(async request => {
    const url = new URL(request.url);

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

      const body = await request.text();

      const error = verifyRequest({
        // Stringified body, or raw body if you have access to it
        body,
        // Pass here the signature from `X-Hive-Signature-256` header
        signature: signatureHeaderValue,
        // Pass here the secret you configured in GraphQL Hive
        secret: env.secret,
      });

      if (error) {
        return new Response(error, { status: 500 });
      } else {
        const result = composeFederation(JSON.parse(body));
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        });
      }
    }

    return new Response('', {
      status: 404,
    });
  });
