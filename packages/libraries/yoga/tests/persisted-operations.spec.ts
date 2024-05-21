import { createServer, Server } from 'http';
import { createSchema, createYoga } from 'graphql-yoga';
import nock from 'nock';
import { beforeAll, expect, test } from 'vitest';
import { useHive } from '../src';

beforeAll(() => {
  nock.cleanAll();
});

test('use persisted operations (GraphQL over HTTP "documentId")', async () => {
  const httpScope = nock('http://artifatcs-cdn.localhost', {
    reqheaders: {
      'X-Hive-CDN-Key': value => {
        expect(value).toBe('foo');
        return true;
      },
    },
  })
    .get('/apps/client-name/client-version/hash')
    .reply(200, 'query { hi }');

  const yoga = createYoga({
    schema: createSchema({
      typeDefs: /* GraphQL */ `
        type Query {
          hi: String
        }
      `,
    }),
    plugins: [
      useHive({
        enabled: false,
        persistedDocuments: {
          endpoint: 'http://artifatcs-cdn.localhost',
          accessToken: 'foo',
        },
      }),
    ],
  });

  const response = await yoga.fetch('http://localhost/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      documentId: 'client-name/client-version/hash',
    }),
  });

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ data: { hi: null } });

  httpScope.done();
});

test('use persisted operations (GraphQL over HTTP "documentId") real thing', async () => {
  const httpScope = nock('http://artifatcs-cdn.localhost', {
    reqheaders: {
      'X-Hive-CDN-Key': value => {
        expect(value).toBe('foo');
        return true;
      },
    },
  })
    .get('/apps/client-name/client-version/hash')
    .reply(200, 'query { hi }');

  const yoga = createYoga({
    schema: createSchema({
      typeDefs: /* GraphQL */ `
        type Query {
          hi: String
        }
      `,
    }),
    plugins: [
      useHive({
        enabled: false,
        persistedDocuments: {
          endpoint: 'http://artifatcs-cdn.localhost',
          accessToken: 'foo',
        },
      }),
    ],
  });

  const server = await new Promise<Server>(res => {
    const server = createServer(yoga).listen(0, () => {
      res(server);
    });
  });
  const port = (server.address() as any).port;

  const response = await fetch(`http://localhost:${port}/graphql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      documentId: 'client-name/client-version/hash',
    }),
  });

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ data: { hi: null } });

  httpScope.done();
});

test('persisted document not found (GraphQL over HTTP "documentId")', async () => {
  const yoga = createYoga({
    schema: createSchema({
      typeDefs: /* GraphQL */ `
        type Query {
          hi: String
        }
      `,
    }),
    plugins: [
      useHive({
        enabled: false,
        persistedDocuments: {
          endpoint: 'http://artifatcs-cdn.localhost',
          accessToken: 'foo',
        },
      }),
    ],
  });

  const httpScope = nock('http://artifatcs-cdn.localhost', {
    reqheaders: {
      'X-Hive-CDN-Key': value => {
        expect(value).toBe('foo');
        return true;
      },
    },
  })
    .get('/apps/client-name/client-version/hash')
    .reply(404);

  const response = await yoga.fetch('http://localhost/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      documentId: 'client-name/client-version/hash',
    }),
  });

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    errors: [
      {
        message: 'Persisted document not found.',
        extensions: {
          code: 'PERSISTED_DOCUMENT_NOT_FOUND',
        },
      },
    ],
  });

  httpScope.done();
});

test('arbitrary options are rejected with allowArbitraryDocuments=false (GraphQL over HTTP)', async () => {
  const yoga = createYoga({
    schema: createSchema({
      typeDefs: /* GraphQL */ `
        type Query {
          hi: String
        }
      `,
    }),
    plugins: [
      useHive({
        enabled: false,
        persistedDocuments: {
          endpoint: 'http://artifatcs-cdn.localhost',
          accessToken: 'foo',
          allowArbitraryDocuments: false,
        },
      }),
    ],
  });

  const response = await yoga.fetch('http://localhost/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: '{hi}',
    }),
  });

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    errors: [
      {
        message: 'No persisted document provided.',
        extensions: { code: 'PERSISTED_DOCUMENT_REQUIRED' },
      },
    ],
  });
});

test('arbitrary options are allowed with allowArbitraryDocuments=true (GraphQL over HTTP)', async () => {
  const yoga = createYoga({
    schema: createSchema({
      typeDefs: /* GraphQL */ `
        type Query {
          hi: String
        }
      `,
    }),
    plugins: [
      useHive({
        enabled: false,
        persistedDocuments: {
          endpoint: 'http://artifatcs-cdn.localhost',
          accessToken: 'foo',
          allowArbitraryDocuments: true,
        },
      }),
    ],
  });

  const response = await yoga.fetch('http://localhost/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: 'query { hi }',
    }),
  });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    data: {
      hi: null,
    },
  });
});

test('use persisted operations (GraphQL REST)', async () => {
  const httpScope = nock('http://artifatcs-cdn.localhost', {
    reqheaders: {
      'X-Hive-CDN-Key': value => {
        expect(value).toBe('foo');
        return true;
      },
    },
  })
    .get('/apps/client-name/client-version/hash')
    .reply(200, 'query { hi }');

  const yoga = createYoga({
    graphqlEndpoint: '/graphql/*?',
    schema: createSchema({
      typeDefs: /* GraphQL */ `
        type Query {
          hi: String
        }
      `,
    }),
    plugins: [
      useHive({
        enabled: false,
        persistedDocuments: {
          endpoint: 'http://artifatcs-cdn.localhost',
          accessToken: 'foo',
        },
      }),
    ],
  });

  const response = await yoga.fetch('http://localhost/graphql/client-name/client-version/hash', {
    method: 'POST',
    body: JSON.stringify({}),
    headers: {
      'Content-Type': 'application/json',
    },
  });

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ data: { hi: null } });

  httpScope.done();
});
