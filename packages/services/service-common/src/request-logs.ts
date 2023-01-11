import type { FastifyInstance, FastifyPluginAsync, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { z } from 'zod';
import { cleanRequestId } from './helpers';

const GraphQLPayloadSchema = z.object({
  operationName: z.string(),
});

const plugin: FastifyPluginAsync = async server => {
  function graphqlOperationName(request: FastifyRequest): string | null {
    let requestBody;
    if (request.method === 'GET') {
      requestBody = request.query;
    } else if (request.method === 'POST') {
      requestBody = request.body;
    } else {
      return null;
    }

    const payload = GraphQLPayloadSchema.safeParse(requestBody);

    if (!payload.success) {
      return null;
    }

    return payload.data.operationName;
  }

  server.addHook('onResponse', async (request, reply) => {
    const requestId = cleanRequestId(request.headers['x-request-id']);
    const operationName = graphqlOperationName(request);
    const message = [
      `[${reply.statusCode}]`,
      `(${request.ip})`,
      request.method,
      request.url,
      operationName ? `'${operationName}'` : null,
      requestId ? `(reqId=${requestId})` : null,
    ]
      .filter(s => s)
      .join(' ');
    if (reply.statusCode < 500) {
      server.log.info(message);
    } else {
      server.log.error(message);
    }
  });
};

const requestLogsPlugin = fp(plugin, {
  name: 'fastify-request-logging',
});

export async function useRequestLogging(server: FastifyInstance) {
  await server.register(requestLogsPlugin);
}
