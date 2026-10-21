import fastify from 'fastify';
import { CorsError, handleRequestError } from '../src/error-handler';

function createServer() {
  const server = fastify({ logger: false });
  server.setErrorHandler(handleRequestError);
  server.get('/boom', async () => {
    throw new Error('boom');
  });
  server.get('/cors', async () => {
    throw new CorsError();
  });
  return server;
}

test('an unhandled error answers 500 instead of leaving the request open', async () => {
  const response = await createServer().inject({ method: 'GET', url: '/boom' });
  expect(response.statusCode).toBe(500);
});

test('a CORS error answers 403 with its message', async () => {
  const response = await createServer().inject({ method: 'GET', url: '/cors' });
  expect(response.statusCode).toBe(403);
  expect(response.body).toBe('CORS origin not allowed.');
});
