import { fastify } from 'fastify';
import cors from 'fastify-cors';
import promClient from 'prom-client';

export { promClient as metrics };

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
