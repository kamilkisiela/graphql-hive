import { createSchema, createYoga } from 'graphql-yoga';
import * as Sentry from '@sentry/node';
import { useHiveErrorHandler } from '../src/graphql-handler';

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

test('a failing GraphQL operation is reported to Sentry with the request id of the request', async () => {
  const yoga = createYoga({
    schema: createSchema({
      typeDefs: 'type Query { boom: String }',
      resolvers: {
        Query: {
          boom: () => {
            throw new Error('boom');
          },
        },
      },
    }),
    plugins: [useHiveErrorHandler(() => {})],
    context: () => ({ req: { log: { error() {} } }, requestId: 'abc' }),
    logging: false,
  });

  const response = await yoga.fetch('http://localhost/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: '{ boom }' }),
  });
  await Sentry.flush();

  expect(response.status).toBe(200);
  expect(events.map(event => event.tags?.request_id)).toEqual(['abc']);
});
