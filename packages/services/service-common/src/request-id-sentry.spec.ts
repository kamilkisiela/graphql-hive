import type { FastifyRequest } from 'fastify';
import * as Sentry from '@sentry/node';
import { initTRPC } from '@trpc/server';
import { createServer } from './fastify';
import { handleTRPCError, registerTRPC } from './trpc';

const events: Sentry.Event[] = [];

beforeAll(() => {
  Sentry.init({
    dsn: 'https://public@sentry.invalid/1',
    defaultIntegrations: false,
    beforeSend(event) {
      events.push(event);
      return null;
    },
  });
});

afterEach(() => {
  events.length = 0;
});

function createTestServer() {
  return createServer({
    name: 'test',
    sentryErrorHandler: true,
    log: { level: 'silent', requests: false },
  });
}

describe('request id on Sentry events', () => {
  test('a failing HTTP request is tagged with the request id of its error response', async () => {
    const server = await createTestServer();
    server.get('/boom', () => {
      throw new Error('boom');
    });

    const response = await server.inject({
      method: 'GET',
      url: '/boom',
      headers: { 'x-request-id': 'abc, def' },
    });
    await Sentry.flush();

    expect(response.json().requestId).toBe('abc');
    expect(events.map(event => event.tags?.request_id)).toEqual(['abc']);
    await server.close();
  });

  test('a failing HTTP request without x-request-id is tagged with the generated id', async () => {
    const server = await createTestServer();
    server.get('/boom', () => {
      throw new Error('boom');
    });

    const response = await server.inject({ method: 'GET', url: '/boom' });
    await Sentry.flush();

    const { requestId } = response.json();
    expect(requestId).toBeTruthy();
    expect(events.map(event => event.tags?.request_id)).toEqual([requestId]);
    await server.close();
  });

  test('a failing tRPC procedure is tagged with the request id', async () => {
    const t = initTRPC.context<{ req: FastifyRequest }>().create();
    const router = t.router({
      boom: t.procedure.use(handleTRPCError).query(() => {
        throw new Error('boom');
      }),
    });
    const server = await createTestServer();
    await registerTRPC(server, { router, createContext: ({ req }) => ({ req }) });

    await server.inject({ method: 'GET', url: '/trpc/boom', headers: { 'x-request-id': 'abc' } });
    await Sentry.flush();

    expect(events.map(event => event.tags?.request_id)).toEqual(['abc']);
    await server.close();
  });
});
