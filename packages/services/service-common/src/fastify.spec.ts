import { createServer } from './fastify';

async function createTestServer() {
  const server = await createServer({
    name: 'test',
    sentryErrorHandler: false,
    log: { level: 'silent', requests: false },
  });
  server.get('/id', req => ({ id: req.id }));
  return server;
}

async function requestId(
  server: Awaited<ReturnType<typeof createTestServer>>,
  headers?: Record<string, string>,
) {
  const response = await server.inject({ method: 'GET', url: '/id', headers });
  return response.json().id as string;
}

describe('createServer request id', () => {
  test('uses the x-request-id sent by the client', async () => {
    const server = await createTestServer();
    await expect(requestId(server, { 'x-request-id': 'abc' })).resolves.toBe('abc');
    await server.close();
  });

  test('keeps only the first value of a comma-joined x-request-id', async () => {
    const server = await createTestServer();
    await expect(requestId(server, { 'x-request-id': ' abc , def' })).resolves.toBe('abc');
    await server.close();
  });

  test('generates an id when the client sends an empty x-request-id', async () => {
    const server = await createTestServer();
    const [first, second] = await Promise.all([
      requestId(server, { 'x-request-id': '' }),
      requestId(server, { 'x-request-id': '' }),
    ]);
    expect(first).toBeTruthy();
    expect(first).not.toBe(second);
    await server.close();
  });

  test('generates an id that is unique across server instances when none is sent', async () => {
    const [a, b] = await Promise.all([createTestServer(), createTestServer()]);
    const [idA, idB] = await Promise.all([requestId(a), requestId(b)]);
    expect(idA).toBeTruthy();
    expect(idA).not.toBe(idB);
    await Promise.all([a.close(), b.close()]);
  });
});

describe('createServer x-request-id response header', () => {
  test('every response carries the request id, including error responses', async () => {
    const server = await createTestServer();
    server.get('/boom', () => {
      throw new Error('boom');
    });

    const ok = await server.inject({
      method: 'GET',
      url: '/id',
      headers: { 'x-request-id': 'abc' },
    });
    const failed = await server.inject({
      method: 'GET',
      url: '/boom',
      headers: { 'x-request-id': 'def' },
    });

    expect(ok.headers['x-request-id']).toBe('abc');
    expect(failed.statusCode).toBe(500);
    expect(failed.headers['x-request-id']).toBe('def');
    await server.close();
  });
});
