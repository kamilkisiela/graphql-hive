import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

const plugin: FastifyPluginAsync = async server => {
  server.addHook('onResponse', async (request, reply) => {
    const message = `[${reply.statusCode}] (${request.ip}) ${request.method} ${request.url}`;

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
