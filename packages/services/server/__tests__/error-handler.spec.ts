import { createServer } from '@hive/service-common';
import { CorsError } from '../src/cors-error';

async function createTestServer() {
  const server = await createServer({
    name: 'test',
    sentryErrorHandler: false,
    log: { requests: false, level: 'silent' },
  });
  server.get('/boom', async () => {
    throw new Error('boom');
  });
  server.get('/cors', async () => {
    throw new CorsError();
  });
  return server;
}

test('an unhandled error answers 500 with the shared JSON body instead of leaving the request open', async () => {
  const response = await (await createTestServer()).inject({ method: 'GET', url: '/boom' });
  expect(response.statusCode).toBe(500);
  expect(response.json()).toMatchObject({ error: 500, message: 'Internal Server Error' });
});

test('a CORS error answers 403 with its message', async () => {
  const response = await (await createTestServer()).inject({ method: 'GET', url: '/cors' });
  expect(response.statusCode).toBe(403);
  expect(response.json()).toMatchObject({ error: 403, message: 'CORS origin not allowed.' });
});
