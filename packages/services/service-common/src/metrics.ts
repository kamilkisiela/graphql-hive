import { fastify } from 'fastify';
import promClient from 'prom-client';
import cors from '@fastify/cors';

export { promClient as metrics };

export const readiness = new promClient.Gauge({
  name: 'service_readiness',
  help: 'Shows if the service is ready to serve requests (1 is ready, 0 is not ready)',
});

export function reportReadiness(isReady: boolean) {
  readiness.set(isReady ? 1 : 0);
}

export async function startMetrics(instanceLabel: string | undefined, port = 10_254) {
  promClient.collectDefaultMetrics({
    labels: { instance: instanceLabel },
  });

  const server = fastify({
    disableRequestLogging: true,
    trustProxy: true,
  });

  server.route({
    method: 'GET',
    url: '/metrics',
    async handler(req, res) {
      try {
        void res.header('Content-Type', promClient.register.contentType);
        const result = await promClient.register.metrics();

        void res.send(result);
      } catch (error) {
        void res.status(500).send(error);
      }
    },
  });

  await server.register(cors);

  return await server.listen({
    port,
    host: '::',
  });
}
