import { createServer, Server } from 'http';
import { createLogger, createSchema, createYoga } from 'graphql-yoga';
import nock from 'nock';
import { beforeAll, expect, test } from 'vitest';
import { useHive } from '../src';

beforeAll(() => {
  nock.cleanAll();
});

const logger = createLogger('silent');

test('use persisted documents (GraphQL over HTTP "documentId")', async () => {
  const httpScope = nock('http://artifacts-cdn.localhost', {
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
        experimental__persistedDocuments: {
          cdn: {
            endpoint: 'http://artifacts-cdn.localhost',
            accessToken: 'foo',
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

  httpScope.done();
});

test('use persisted documents (GraphQL over HTTP "documentId") real thing', async () => {
  const httpScope = nock('http://artifacts-cdn.localhost', {
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
        experimental__persistedDocuments: {
          cdn: {
            endpoint: 'http://artifacts-cdn.localhost',
            accessToken: 'foo',
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

  httpScope.done();
});

test('persisted document not found (GraphQL over HTTP "documentId")', async () => {
  const httpScope = nock('http://artifacts-cdn.localhost', {
    reqheaders: {
      'X-Hive-CDN-Key': value => {
        expect(value).toBe('foo');
        return true;
      },
    },
  })
    .get('/apps/client-name/client-version/hash')
    .reply(404);

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
        experimental__persistedDocuments: {
          cdn: {
            endpoint: 'http://artifacts-cdn.localhost',
            accessToken: 'foo',
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
        experimental__persistedDocuments: {
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
        experimental__persistedDocuments: {
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
  const httpScope = nock('http://artifacts-cdn.localhost', {
    reqheaders: {
      'X-Hive-CDN-Key': value => {
        expect(value).toBe('foo');
        return true;
      },
    },
  })
    .get('/apps/client-name/client-version/hash')
    .reply(200, 'subscription { hi }');

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
        experimental__persistedDocuments: {
          cdn: {
            endpoint: 'http://artifacts-cdn.localhost',
            accessToken: 'foo',
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

  httpScope.done();
});

test('use persisted documents for subscription over SSE (GraphQL over HTTP "documentId")', async () => {
  const httpScope = nock('http://artifacts-cdn.localhost', {
    reqheaders: {
      'X-Hive-CDN-Key': value => {
        expect(value).toBe('foo');
        return true;
      },
    },
  })
    .get('/apps/client-name/client-version/hash')
    .reply(200, 'subscription { hi }');

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
        experimental__persistedDocuments: {
          cdn: {
            endpoint: 'http://artifacts-cdn.localhost',
            accessToken: 'foo',
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

  httpScope.done();
});

test('usage reporting for persisted document', async () => {
  const httpScope = nock('http://artifacts-cdn.localhost', {
    reqheaders: {
      'X-Hive-CDN-Key': value => {
        expect(value).toBe('foo');
        return true;
      },
    },
  })
    .get('/apps/client-name/client-version/hash')
    .reply(200, 'query { hi }');

  const usageScope = nock('http://localhost', {
    reqheaders: {
      Authorization: value => {
        expect(value).toBe('Bearer brrrt');
        return true;
      },
    },
  })
    .post('/usage', body => {
      expect(body.map).toMatchInlineSnapshot(`
        {
          ace78a32bbf8a79071356e5d5b13c5c83baf4e14: {
            fields: [
              Query.hi,
            ],
            operation: {hi},
            operationName: anonymous,
          },
        }
      `);

      expect(body.operations).toMatchObject([
        {
          metadata: {},
          operationMapKey: 'ace78a32bbf8a79071356e5d5b13c5c83baf4e14',
          persistedDocumentHash: 'client-name~client-version~hash',
        },
      ]);

      return true;
    })
    .reply(200);

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
        experimental__persistedDocuments: {
          cdn: {
            endpoint: 'http://artifacts-cdn.localhost',
            accessToken: 'foo',
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
        },
      }),
    ],
  });

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      resolve();
    }, 1000);
    let requestCount = 0;

    usageScope.on('request', () => {
      requestCount = requestCount + 1;
      if (requestCount === 1) {
        clearTimeout(timeout);
        resolve();
      }
    });

    (async () => {
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
    })().catch(reject);
  });

  httpScope.done();
  usageScope.done();
});

test('usage reporting for persisted document (subscription)', async () => {
  const httpScope = nock('http://artifacts-cdn.localhost', {
    reqheaders: {
      'X-Hive-CDN-Key': value => {
        expect(value).toBe('foo');
        return true;
      },
    },
  })
    .get('/apps/client-name/client-version/hash')
    .reply(200, 'subscription { hi }');

  const usageScope = nock('http://localhost', {
    reqheaders: {
      Authorization: value => {
        expect(value).toBe('Bearer brrrt');
        return true;
      },
    },
  })
    .post('/usage', body => {
      expect(body.map).toMatchInlineSnapshot(`
        {
          74cf03b67c3846231d04927b02e1fca45e727223: {
            fields: [
              Subscription.hi,
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

      return true;
    })
    .reply(200);

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
        experimental__persistedDocuments: {
          cdn: {
            endpoint: 'http://artifacts-cdn.localhost',
            accessToken: 'foo',
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
        },
      }),
    ],
  });

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      resolve();
    }, 1000);
    let requestCount = 0;

    usageScope.on('request', () => {
      requestCount = requestCount + 1;
      if (requestCount === 1) {
        clearTimeout(timeout);
        resolve();
      }
    });

    (async () => {
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
    })().catch(reject);
  });

  httpScope.done();
  usageScope.done();
});

test('deduplication of parallel requests resolving the same document from CDN', async () => {
  const httpScope = nock('http://artifacts-cdn.localhost', {
    reqheaders: {
      'X-Hive-CDN-Key': value => {
        expect(value).toBe('foo');
        return true;
      },
    },
  })
    // Note: this handler is only invoked for the first call, additional calls will fail.
    .get('/apps/client-name/client-version/hash')
    .reply(200, () => {
      return 'query { hi }';
    });

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
        experimental__persistedDocuments: {
          cdn: {
            endpoint: 'http://artifacts-cdn.localhost',
            accessToken: 'foo',
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

  httpScope.done();
});
