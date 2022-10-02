import './dev-polyfill';
import { createServer } from '@hive/service-common';
import { handleRequest } from './handler';
import { devStorage } from './dev-polyfill';
import { isKeyValid } from './auth';
import { createServerAdapter } from '@whatwg-node/server';
import { FastifyRequest, FastifyReply } from 'fastify';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4010;

async function main() {
  const server = await createServer({
    tracing: false,
    name: 'local_cdn',
  });

  server.route<{
    Params: {
      accountId: string;
      namespaceId: string;
      key: string;
    };
  }>({
    url: '/:accountId/storage/kv/namespaces/:namespaceId/values/:key',
    method: 'PUT',
    handler: async request => {
      if (!request.params.key) {
        throw new Error(`Missing key`);
      }

      if (!request.body) {
        throw new Error(`Missing body value`);
      }

      console.log(`Writing to ephermal storage: ${request.params.key}, value: ${request.body}`);

      devStorage.set(request.params.key, request.body as string);

      return {
        success: true,
      };
    },
  });

  server.route({
    url: '/dump',
    method: 'GET',
    handler: async () => {
      return Object.fromEntries(devStorage.entries());
    },
  });

  server.route({
    url: '/_readiness',
    method: 'GET',
    handler: async (_, res) => {
      res.status(200).send();
    },
  });

  const serverAdapter = createServerAdapter<{
    req: FastifyRequest;
    reply: FastifyReply;
  }>(req => handleRequest(req, isKeyValid));

  server.route({
    url: '*',
    method: ['GET'],
    handler: async (req, reply) => {
      const response = await serverAdapter.handleNodeRequest(req, {
        req,
        reply,
      });
      response.headers.forEach((value, key) => {
        reply.header(key, value);
      });

      reply.status(response.status);

      reply.send(response.body);

      return reply;
    },
  });

  await server.listen(PORT, '0.0.0.0');
}

main().catch(e => console.error(e));
