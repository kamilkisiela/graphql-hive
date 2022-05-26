import { fastify } from 'fastify';
import cors from 'fastify-cors';
import promClient from 'prom-client';

export { promClient as metrics };

export const readiness = new promClient.Gauge({
  name: 'service_readiness',
  help: 'Shows if the service is ready to serve requests (1 is ready, 0 is not ready)',
});

export function reportReadiness(isReady: boolean) {
  readiness.set(isReady ? 1 : 0);
}

export function startMetrics() {
  promClient.collectDefaultMetrics({
    labels: { instance: process.env.POD_NAME },
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
        res.header('Content-Type', promClient.register.contentType);
        const result = await promClient.register.metrics();

        res.send(result);
      } catch (error) {
        console.log('metrics error', error);
        res.status(500).send(error);
      }
    },
  });

  server.register(cors);

  return server.listen(10254, '0.0.0.0');
}
