import { createServer, Server } from 'http';
import { createLogger, createSchema, createYoga } from 'graphql-yoga';
import { expect, test, vi } from 'vitest';
import { useHive } from '../src';

const logger = createLogger('silent');

test('use persisted documents (GraphQL over HTTP "documentId")', async () => {
  let url: string | undefined;
  let cdnHeader: string | undefined;

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
          cdn: {
            endpoint: 'http://artifacts-cdn.localhost',
            accessToken: 'foo',
          },
          async fetch(uurl, params) {
            url = uurl as string;
            cdnHeader = (params?.headers as Record<string, string>)?.['X-Hive-CDN-Key'];
            return new Response('query { hi }');
          },
        },
        agent: {
          logger,
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
      documentId: 'client-name~client-version~hash',
    }),
  });

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ data: { hi: null } });

  expect(url).toEqual('http://artifacts-cdn.localhost/apps/client-name/client-version/hash');
  expect(cdnHeader).toEqual('foo');
});

test('use persisted documents (GraphQL over HTTP "documentId") real thing', async () => {
  let url: string | undefined;
  let cdnHeader: string | undefined;

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
          cdn: {
            endpoint: 'http://artifacts-cdn.localhost',
            accessToken: 'foo',
          },
          async fetch(uurl, params) {
            url = uurl as string;
            cdnHeader = (params?.headers as Record<string, string>)?.['X-Hive-CDN-Key'];
            return new Response('query { hi }');
          },
        },
        agent: {
          logger,
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
      documentId: 'client-name~client-version~hash',
    }),
  });

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ data: { hi: null } });

  expect(url).toEqual('http://artifacts-cdn.localhost/apps/client-name/client-version/hash');
  expect(cdnHeader).toEqual('foo');
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
          cdn: {
            endpoint: 'http://artifacts-cdn.localhost',
            accessToken: 'foo',
          },
          async fetch() {
            return new Response('', {
              status: 404,
            });
          },
        },
        agent: {
          logger,
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
      documentId: 'client-name~client-version~hash',
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
});

test('malformed document ID returns validation error instead of 500 (GraphQL over HTTP "documentId")', async () => {
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
          cdn: {
            endpoint: 'http://artifacts-cdn.localhost',
            accessToken: 'foo',
          },
          async fetch() {
            throw new Error('CDN fetch should not be called for malformed document IDs');
          },
        },
        agent: {
          logger,
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
      documentId: 'whatever',
    }),
  });

  expect(response.status).toBe(200);
  const json = await response.json();
  expect(json.errors).toBeDefined();
  expect(json.errors).toHaveLength(1);
  expect(json.errors[0].extensions.code).toBe('INVALID_DOCUMENT_ID');
  expect(json.errors[0].message).toContain('Expected format');
});

test('document ID with wrong number of parts returns validation error', async () => {
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
          cdn: {
            endpoint: 'http://artifacts-cdn.localhost',
            accessToken: 'foo',
          },
          async fetch() {
            throw new Error('CDN fetch should not be called for malformed document IDs');
          },
        },
        agent: {
          logger,
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
      documentId: 'client-name~client-version',
    }),
  });

  expect(response.status).toBe(200);
  const json = await response.json();
  expect(json.errors).toBeDefined();
  expect(json.errors).toHaveLength(1);
  expect(json.errors[0].extensions.code).toBe('INVALID_DOCUMENT_ID');
  expect(json.errors[0].message).toContain('Expected format');
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
          cdn: {
            endpoint: 'http://artifacts-cdn.localhost',
            accessToken: 'foo',
          },
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
          cdn: {
            endpoint: 'http://artifacts-cdn.localhost',
            accessToken: 'foo',
          },
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

test('use persisted documents for SSE GET (GraphQL over HTTP "documentId")', async () => {
  let url: string | undefined;
  let cdnHeader: string | undefined;

  const yoga = createYoga({
    schema: createSchema({
      typeDefs: /* GraphQL */ `
        type Query {
          hi: String
        }

        type Subscription {
          hi: String
        }
      `,
      resolvers: {
        Subscription: {
          hi: {
            async *subscribe() {
              yield { hi: 'hi' };
            },
          },
        },
      },
    }),
    plugins: [
      useHive({
        enabled: false,
        persistedDocuments: {
          cdn: {
            endpoint: 'http://artifacts-cdn.localhost',
            accessToken: 'foo',
          },
          async fetch(uurl, params) {
            url = uurl as string;
            cdnHeader = (params?.headers as Record<string, string>)?.['X-Hive-CDN-Key'];
            return new Response('subscription { hi }');
          },
        },
        agent: {
          logger,
        },
      }),
    ],
  });

  const response = await yoga.fetch('http://localhost/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({
      documentId: 'client-name~client-version~hash',
    }),
  });

  expect(response.status).toBe(200);
  expect(await response.text()).toMatchInlineSnapshot(`
    :

    event: next
    data: {"data":{"hi":"hi"}}

    event: complete
    data:
  `);

  expect(url).toEqual('http://artifacts-cdn.localhost/apps/client-name/client-version/hash');
  expect(cdnHeader).toEqual('foo');
});

test('use persisted documents for subscription over SSE (GraphQL over HTTP "documentId")', async () => {
  let url: string | undefined;
  let cdnHeader: string | undefined;

  const yoga = createYoga({
    schema: createSchema({
      typeDefs: /* GraphQL */ `
        type Query {
          hi: String
        }

        type Subscription {
          hi: String
        }
      `,
      resolvers: {
        Subscription: {
          hi: {
            async *subscribe() {
              yield { hi: 'hi' };
            },
          },
        },
      },
    }),
    plugins: [
      useHive({
        enabled: false,
        persistedDocuments: {
          cdn: {
            endpoint: 'http://artifacts-cdn.localhost',
            accessToken: 'foo',
          },
          async fetch(uurl, params) {
            url = uurl as string;
            cdnHeader = (params?.headers as Record<string, string>)?.['X-Hive-CDN-Key'];
            return new Response('subscription { hi }');
          },
        },
        agent: {
          logger,
        },
      }),
    ],
  });

  const response = await yoga.fetch(
    'http://localhost/graphql?documentId=client-name~client-version~hash',
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
    },
  );

  expect(response.status).toBe(200);
  expect(await response.text()).toMatchInlineSnapshot(`
    :

    event: next
    data: {"data":{"hi":"hi"}}

    event: complete
    data:
  `);

  expect(url).toEqual('http://artifacts-cdn.localhost/apps/client-name/client-version/hash');
  expect(cdnHeader).toEqual('foo');
});

test('usage reporting for persisted document', async () => {
  const lookupfetchCallFn = vi.fn();
  const usageD = Promise.withResolvers<Array<unknown>>();

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
        enabled: true,
        debug: false,
        token: 'brrrt',
        persistedDocuments: {
          cdn: {
            endpoint: 'http://artifacts-cdn.localhost',
            accessToken: 'foo',
          },
          async fetch(...args) {
            lookupfetchCallFn(...args);
            return new Response('query { hi }');
          },
        },
        selfHosting: {
          applicationUrl: 'http://localhost/foo',
          graphqlEndpoint: 'http://localhost/graphql',
          usageEndpoint: 'http://localhost/usage',
        },
        usage: {
          endpoint: 'http://localhost/usage',
        },
        agent: {
          maxSize: 1,
          logger: createLogger('silent'),
          async fetch(...args) {
            usageD.resolve(args);
            return new Response('');
          },
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
      documentId: 'client-name~client-version~hash',
    }),
  });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ data: { hi: null } });

  expect(lookupfetchCallFn.mock.calls).toHaveLength(1);
  expect(lookupfetchCallFn.mock.calls[0][0]).toEqual(
    'http://artifacts-cdn.localhost/apps/client-name/client-version/hash',
  );
  expect(lookupfetchCallFn.mock.calls[0][1]).toMatchObject({
    headers: {
      'X-Hive-CDN-Key': 'foo',
    },
    method: 'GET',
  });

  const usageResponseArgs = await usageD.promise;
  expect(usageResponseArgs[0]).toEqual('http://localhost/usage');
  const body = JSON.parse((usageResponseArgs[1] as any).body);
  expect(body.map).toEqual({
    ace78a32bbf8a79071356e5d5b13c5c83baf4e14: {
      operation: '{hi}',
      operationName: 'anonymous',
      fields: ['Query.hi', 'String'],
    },
  });
});

test('usage reporting for persisted document (subscription)', async () => {
  const lookupfetchCallFn = vi.fn();
  const usageD = Promise.withResolvers<Array<unknown>>();

  const yoga = createYoga({
    schema: createSchema({
      typeDefs: /* GraphQL */ `
        type Query {
          hi: String
        }
        type Subscription {
          hi: String
        }
      `,
      resolvers: {
        Subscription: {
          hi: {
            async *subscribe() {
              yield { hi: 'hi' };
            },
          },
        },
      },
    }),
    plugins: [
      useHive({
        enabled: true,
        debug: false,
        token: 'brrrt',
        persistedDocuments: {
          cdn: {
            endpoint: 'http://artifacts-cdn.localhost',
            accessToken: 'foo',
          },
          async fetch(...args) {
            lookupfetchCallFn(...args);
            return new Response('subscription { hi }');
          },
        },
        selfHosting: {
          applicationUrl: 'http://localhost/foo',
          graphqlEndpoint: 'http://localhost/graphql',
          usageEndpoint: 'http://localhost/usage',
        },
        usage: {
          endpoint: 'http://localhost/usage',
        },
        agent: {
          maxSize: 1,
          logger: createLogger('silent'),
          async fetch(...args) {
            usageD.resolve(args);
            return new Response('');
          },
        },
      }),
    ],
  });

  const response = await yoga.fetch('http://localhost/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({
      documentId: 'client-name~client-version~hash',
    }),
  });
  expect(response.status).toBe(200);
  expect(await response.text()).toMatchInlineSnapshot(`
        :

        event: next
        data: {"data":{"hi":"hi"}}

        event: complete
        data:
      `);

  expect(lookupfetchCallFn.mock.calls).toHaveLength(1);
  expect(lookupfetchCallFn.mock.calls[0][0]).toEqual(
    'http://artifacts-cdn.localhost/apps/client-name/client-version/hash',
  );
  expect(lookupfetchCallFn.mock.calls[0][1]).toMatchObject({
    headers: {
      'X-Hive-CDN-Key': 'foo',
    },
    method: 'GET',
  });

  const usageResponseArgs = await usageD.promise;
  expect(usageResponseArgs[0]).toEqual('http://localhost/usage');
  const body = JSON.parse((usageResponseArgs[1] as any).body);
  expect(body.map).toMatchInlineSnapshot(`
        {
          74cf03b67c3846231d04927b02e1fca45e727223: {
            fields: [
              Subscription.hi,
              String,
            ],
            operation: subscription{hi},
            operationName: anonymous,
          },
        }
      `);

  expect(body.subscriptionOperations).toMatchObject([
    {
      metadata: {},
      operationMapKey: '74cf03b67c3846231d04927b02e1fca45e727223',
      persistedDocumentHash: 'client-name~client-version~hash',
    },
  ]);
});

test('deduplication of parallel requests resolving the same document from CDN', async () => {
  const lookupfetchCallFn = vi.fn();

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
          cdn: {
            endpoint: 'http://artifacts-cdn.localhost',
            accessToken: 'foo',
          },
          async fetch(...args) {
            lookupfetchCallFn(...args);
            return new Response('query { hi }');
          },
        },
        agent: {
          logger,
        },
      }),
    ],
  });

  const request = async () =>
    yoga.fetch('http://localhost/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        documentId: 'client-name~client-version~hash',
      }),
    });

  const [request1, request2] = await Promise.all([request(), request()]);
  expect(request1.status).toBe(200);
  expect(await request1.json()).toEqual({ data: { hi: null } });
  expect(request2.status).toBe(200);
  expect(await request2.json()).toEqual({ data: { hi: null } });

  expect(lookupfetchCallFn).toHaveBeenCalledOnce();
});

test('usage reporting with batch execution and persisted documents', async () => {
  const usageD = Promise.withResolvers<Array<unknown>>();

  const yoga = createYoga({
    schema: createSchema({
      typeDefs: /* GraphQL */ `
        type Query {
          a: String
          b: String
        }
      `,
    }),
    batching: true,
    plugins: [
      useHive({
        token: 'foo',
        enabled: true,
        persistedDocuments: {
          cdn: {
            endpoint: 'http://artifacts-cdn.localhost',
            accessToken: 'foo',
          },
          async fetch(url) {
            if ((url as string).endsWith('/apps/client-name/client-version/a')) {
              return new Response('query { a }');
            }

            if ((url as string).endsWith('/apps/client-name/client-version/b')) {
              return new Response('query { b }');
            }

            return new Response('', { status: 400 });
          },
        },
        agent: {
          maxSize: 2,
          logger: createLogger('silent'),
          sendInterval: 10,
          async fetch(...args) {
            usageD.resolve(args);
            return new Response('');
          },
        },
        selfHosting: {
          applicationUrl: 'http://localhost/foo',
          graphqlEndpoint: 'http://localhost/graphql',
          usageEndpoint: 'http://localhost/usage',
        },
        usage: {
          endpoint: 'http://localhost/usage',
          max: 2,
        },
      }),
    ],
  });

  const request = await yoga.fetch('http://localhost/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([
      {
        documentId: 'client-name~client-version~a',
      },
      {
        documentId: 'client-name~client-version~b',
      },
    ]),
  });
  expect(request.status).toBe(200);
  expect(await request.json()).toEqual([{ data: { a: null } }, { data: { b: null } }]);

  const usageResponseArgs = await usageD.promise;

  const body = JSON.parse((usageResponseArgs[1] as any).body);
  expect(body.map).toMatchInlineSnapshot(`
    {
      07188723c7bd37a812cb478cc980f83fe5b4026c: {
        fields: [
          Query.a,
          String,
        ],
        operation: {a},
        operationName: anonymous,
      },
      e8571e61911eea36db5ef7a3ed222aacb0cd5ba1: {
        fields: [
          Query.b,
          String,
        ],
        operation: {b},
        operationName: anonymous,
      },
    }
  `);
});

test('L2 cache with waitUntil from yoga context', () => {
  expect.assertions(5);
  const setDeferred = Promise.withResolvers<void>();
  const l2Cache = {
    get: vi.fn().mockResolvedValue(null), // cache miss
    set: vi.fn().mockImplementation(() => {
      return setDeferred.promise;
    }),
  };

  let resolved = false;
  const dispose$ = Promise.resolve()
    .then(async () => {
      await using yoga = createYoga({
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
              cdn: {
                endpoint: 'http://artifacts-cdn.localhost',
                accessToken: 'foo',
              },
              layer2Cache: {
                cache: l2Cache,
                ttlSeconds: 3600,
              },
              async fetch() {
                return new Response('query { hi }');
              },
            },
            agent: {
              logger,
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
          documentId: 'client-name~client-version~hash',
        }),
      });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ data: { hi: null } });

      // L2 cache should have been checked
      expect(l2Cache.get).toHaveBeenCalledWith('client-name~client-version~hash');

      // L2 cache set should have been called
      expect(l2Cache.set).toHaveBeenCalledWith('client-name~client-version~hash', 'query { hi }', {
        ttl: 3600,
      });
    })
    .then(() => {
      resolved = true;
    });

  expect(resolved).toBe(false); // Should still be pending

  setDeferred.resolve();
  return dispose$;
});

test('L2 cache hit skips CDN fetch', async () => {
  const cdnFetch = vi.fn();
  const l2Cache = {
    get: vi.fn().mockResolvedValue('query { hi }'), // cache hit
    set: vi.fn(),
  };

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
          cdn: {
            endpoint: 'http://artifacts-cdn.localhost',
            accessToken: 'foo',
          },
          layer2Cache: {
            cache: l2Cache,
          },
          async fetch(...args) {
            cdnFetch(...args);
            return new Response('query { hi }');
          },
        },
        agent: {
          logger,
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
      documentId: 'client-name~client-version~hash',
    }),
  });

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ data: { hi: null } });

  // L2 cache was checked
  expect(l2Cache.get).toHaveBeenCalledWith('client-name~client-version~hash');
  // CDN was NOT called because L2 cache hit
  expect(cdnFetch).not.toHaveBeenCalled();
  // L2 set was NOT called because data came from L2
  expect(l2Cache.set).not.toHaveBeenCalled();
});
