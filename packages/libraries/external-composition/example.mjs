/* eslint-disable */
/// @ts-check
import fastify from 'fastify';
import { parse, printSchema } from 'graphql';
import { composeAndValidate, compositionHasErrors } from '@apollo/federation';
import { compose, signatureHeaderName, verifyRequest } from './src/index';

if (typeof process.env.PORT === 'undefined') {
  throw new Error('PORT environment variable must be set');
}

if (typeof process.env.SECRET === 'undefined') {
  throw new Error('SECRET environment variable must be set');
}

const SECRET = process.env.SECRET;
const PORT = process.env.PORT;

/**
 * @type string[]
 */
const history = [];

const composeFederation = compose(services => {
  const result = composeAndValidate(
    services.map(service => {
      history.push(service.name);
      return {
        typeDefs: parse(service.sdl),
        name: service.name,
        url: service.url,
      };
    }),
  );

  if (compositionHasErrors(result)) {
    return {
      type: 'failure',
      result: {
        errors: result.errors.map(err => ({
          message: err.message,
          source: typeof err.extensions?.code === 'string' ? 'composition' : 'graphql',
        })),
      },
    };
  } else {
    return {
      type: 'success',
      result: {
        supergraph: result.supergraphSdl,
        sdl: printSchema(result.schema),
      },
    };
  }
});

async function main() {
  const server = fastify({});

  server.route({
    method: ['GET'],
    url: '/_history',
    handler(_, res) {
      res.send(JSON.stringify(history));
    },
  });

  server.route({
    method: ['GET', 'OPTIONS'],
    url: '/_readiness',
    handler(_, res) {
      res.status(200).send('OK');
    },
  });

  server.route({
    method: ['POST'],
    url: '/compose',
    handler(req, res) {
      /**
       * @type any
       */
      const signature = req.headers[signatureHeaderName];
      const error = verifyRequest({
        body: JSON.stringify(req.body),
        signature: signature,
        secret: SECRET,
      });

      if (error) {
        // Failed to verify the request
        res.status(500).send(error);
      } else {
        /**
         * @type any
         */
        const input = req.body;
        const result = composeFederation(input);
        res.send(JSON.stringify(result));
      }
    },
  });

  /**
   * used for testing
   */

  server.route({
    method: ['POST'],
    url: '/fail_on_signature',
    handler(req, res) {
      /**
       * @type any
       */
      const signature = req.headers[signatureHeaderName];
      const error = verifyRequest({
        body: JSON.stringify(req.body),
        signature: signature,
        secret: SECRET + 'wrong = fail',
      });

      if (error) {
        // Failed to verify the request
        res.status(500).send(error);
      } else {
        /**
         * @type any
         */
        const input = req.body;
        const result = composeFederation(input);
        res.send(JSON.stringify(result));
      }
    },
  });

  server.route({
    method: ['POST'],
    url: '/timeout',
    handler(_req, res) {
      setTimeout(() => {
        res.status(500).send('did not expect to get here');
      }, 35_000);
    },
  });

  /**
   * ok, we're back from testing
   */

  await server.listen({
    port: parseInt(PORT, 10),
  });

  console.log(`Server listening on port ${PORT}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
