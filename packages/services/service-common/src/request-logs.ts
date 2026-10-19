import type { FastifyInstance, FastifyPluginAsync, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { z } from 'zod';

const GraphQLPayloadSchema = z.object({
  operationName: z.string().optional(),
  documentId: z.string().optional(),
});

const plugin: FastifyPluginAsync = async server => {
  function graphqlOperationIdentifier(
    request: FastifyRequest,
  ):
    | { kind: 'raw-query'; operationName: string }
    | { kind: 'persisted'; persistedDocumentId: string }
    | null {
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

    if (payload.data.operationName) {
      return { kind: 'raw-query', operationName: payload.data.operationName };
    }

    if (payload.data.documentId) {
      return { kind: 'persisted', persistedDocumentId: payload.data.documentId };
    }

    return null;
  }

  server.addHook('onResponse', async (request, reply) => {
    if (
      request.url === '/_readiness' ||
      request.url === '/_health' ||
      request.url === '/graphql?readiness=true'
    ) {
      // Don't log health checks
      return;
    }

    const requestId = request.id;
    const operationIdentifier = graphqlOperationIdentifier(request);
    const identifier =
      operationIdentifier?.kind === 'raw-query'
        ? operationIdentifier.operationName
        : operationIdentifier?.kind === 'persisted'
          ? `${operationIdentifier.persistedDocumentId} (persisted)`
          : null;
    const message = [
      `[${reply.statusCode}]`,
      `(${request.ip})`,
      request.method,
      request.url,
      identifier,
      `(reqId=${requestId})`,
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
