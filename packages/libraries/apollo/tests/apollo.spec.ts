import { createServer, IncomingMessage, Server } from 'node:http';
import bodyParser from 'body-parser';
import express from 'express';
import { execute, subscribe } from 'graphql';
import { createClient } from 'graphql-ws';
import { useServer } from 'graphql-ws/lib/use/ws';
import nock from 'nock';
import { beforeAll, describe, expect, test, vi } from 'vitest';
import { WebSocket, WebSocketServer } from 'ws';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { startStandaloneServer } from '@apollo/server/standalone';
import { http } from '@graphql-hive/core';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { createHive, createSupergraphSDLFetcher, useHive } from '../src';
import { version } from '../src/version';

function createLogger() {
  return {
    error: vi.fn(),
    info: vi.fn(),
  };
}

beforeAll(() => {
  nock.cleanAll();
});

function waitFor(ms: number) {
  return new Promise<void>(resolve => {
    setTimeout(resolve, ms);
  });
}

const typeDefs = /* GraphQL */ `
  type Query {
    hello: String
  }
`;

const resolvers = {
  Query: {
    hello() {
      return 'Hello world';
    },
  },
};

function handleProcess() {
  function fail(error: any) {
    throw error;
  }

  process.once('uncaughtException', fail);
  process.once('unhandledRejection', fail);

  return () => {
    process.removeListener('uncaughtException', fail);
    process.removeListener('unhandledRejection', fail);
  };
}

test('should not interrupt the process', async () => {
  const logger = {
    error: vi.fn(),
    info: vi.fn(),
  };
  const clean = handleProcess();
  const apollo = new ApolloServer({
    typeDefs,
    resolvers,
    plugins: [
      useHive({
        enabled: true,
        debug: true,
        token: 'my-token',
        agent: {
          maxRetries: 0,
          sendInterval: 10,
          timeout: 50,
          logger,
        },
        reporting: {
          endpoint: 'http://404.localhost/registry',
          author: 'jest',
          commit: 'js',
        },
        usage: {
          endpoint: 'http://404.localhost/usage',
        },
      }),
    ],
  });

  await apollo.executeOperation({
    query: /* GraphQL */ `
      {
        hello
      }
    `,
  });
  await waitFor(50);
  await apollo.stop();
  clean();
  expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('[hive][info]'));
  expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('[hive][usage]'));
  expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('[hive][reporting]'));
}, 1_000);

test('should capture client name and version headers', async () => {
  const clean = handleProcess();
  const fetchSpy = vi.fn<[RequestInfo | URL, options: RequestInit | undefined]>(async () =>
    Response.json({}, { status: 200 }),
  );

  const apollo = new ApolloServer({
    typeDefs,
    resolvers,
    plugins: [
      useHive({
        enabled: true,
        debug: false,
        token: 'my-token',
        agent: {
          maxRetries: 0,
          sendInterval: 10,
          timeout: 50,
          __testing: {
            fetch: fetchSpy,
          },
        },
        reporting: false,
        usage: {
          endpoint: 'http://apollo.localhost:4200/usage',
        },
      }),
    ],
  });

  await startStandaloneServer(apollo);

  await http.post(
    'http://localhost:4000/graphql',
    JSON.stringify({
      query: /* GraphQL */ `
        {
          hello
        }
      `,
    }),
    {
      headers: {
        'content-type': 'application/json',
        'x-graphql-client-name': 'vitest',
        'x-graphql-client-version': '1.0.0',
      },
    },
  );

  await waitFor(50);
  await apollo.stop();
  expect(fetchSpy).toHaveBeenCalledWith(
    'http://apollo.localhost:4200/usage',
    expect.objectContaining({
      body: expect.stringContaining('"client":{"name":"vitest","version":"1.0.0"}'),
    }),
  );
  clean();
}, 1_000);

describe('supergraph SDL fetcher', async () => {
  test('createSupergraphSDLFetcher without ETag', async () => {
    const supergraphSdl = 'type SuperQuery { sdl: String }';
    const newSupergraphSdl = 'type NewSuperQuery { sdl: String }';
    const key = 'secret-key';
    nock('http://localhost')
      .get('/supergraph')
      .once()
      .matchHeader('X-Hive-CDN-Key', key)
      .reply(200, supergraphSdl, {
        ETag: 'first',
      })
      .get('/supergraph')
      .once()
      .matchHeader('X-Hive-CDN-Key', key)
      .matchHeader('User-Agent', `hive-client/${version}`)
      .reply(200, newSupergraphSdl, {
        ETag: 'second',
      });

    const fetcher = createSupergraphSDLFetcher({
      endpoint: 'http://localhost',
      key,
    });

    const result = await fetcher();

    expect(result.id).toBeDefined();
    expect(result.supergraphSdl).toEqual(supergraphSdl);

    const secondResult = await fetcher();

    expect(secondResult.id).toBeDefined();
    expect(secondResult.supergraphSdl).toEqual(newSupergraphSdl);
  });

  test('createSupergraphSDLFetcher', async () => {
    const supergraphSdl = 'type SuperQuery { sdl: String }';
    const newSupergraphSdl = 'type Query { sdl: String }';
    const key = 'secret-key';
    nock('http://localhost')
      .get('/supergraph')
      .once()
      .matchHeader('X-Hive-CDN-Key', key)
      .reply(200, supergraphSdl, {
        ETag: 'first',
      })
      .get('/supergraph')
      .once()
      .matchHeader('X-Hive-CDN-Key', key)
      .matchHeader('If-None-Match', 'first')
      .reply(304)
      .get('/supergraph')
      .matchHeader('X-Hive-CDN-Key', key)
      .matchHeader('User-Agent', `hive-client/${version}`)
      .matchHeader('If-None-Match', 'first')
      .reply(200, newSupergraphSdl, {
        ETag: 'changed',
      });

    const fetcher = createSupergraphSDLFetcher({
      endpoint: 'http://localhost',
      key,
    });

    const result = await fetcher();

    expect(result.id).toBeDefined();
    expect(result.supergraphSdl).toEqual(supergraphSdl);

    const cachedResult = await fetcher();

    expect(cachedResult.id).toBeDefined();
    expect(cachedResult.supergraphSdl).toEqual(supergraphSdl);

    const staleResult = await fetcher();

    expect(staleResult.id).toBeDefined();
    expect(staleResult.supergraphSdl).toEqual(newSupergraphSdl);
  });

  test('createSupergraphSDLFetcher retry with unexpected status code (nRetryCount=10)', async () => {
    const supergraphSdl = 'type SuperQuery { sdl: String }';
    const key = 'secret-key';
    nock('http://localhost')
      .get('/supergraph')
      .times(10)
      .reply(500)
      .get('/supergraph')
      .once()
      .matchHeader('X-Hive-CDN-Key', key)
      .reply(200, supergraphSdl, {
        ETag: 'first',
      });

    const fetcher = createSupergraphSDLFetcher({
      endpoint: 'http://localhost',
      key,
    });

    const result = await fetcher();

    expect(result.id).toBeDefined();
    expect(result.supergraphSdl).toEqual(supergraphSdl);
  });

  test('createSupergraphSDLFetcher retry with unexpected status code (nRetryCount=11)', async () => {
    expect.assertions(1);
    const supergraphSdl = 'type SuperQuery { sdl: String }';
    const key = 'secret-key';
    nock('http://localhost')
      .get('/supergraph')
      .times(11)
      .reply(500)
      .get('/supergraph')
      .once()
      .matchHeader('X-Hive-CDN-Key', key)
      .reply(200, supergraphSdl, {
        ETag: 'first',
      });

    const fetcher = createSupergraphSDLFetcher({
      endpoint: 'http://localhost',
      key,
    });

    try {
      await fetcher();
    } catch (err) {
      expect(err).toMatchInlineSnapshot(
        `[Error: Failed to fetch http://localhost/supergraph, received: 500 Internal Server Error]`,
      );
    }
  });
});

describe('built-in HTTP usage reporting', async () => {
  test('successful query operation is reported', async () => {
    const graphqlScope = nock('http://localhost')
      .post('/usage', body => {
        expect(body.map).toMatchInlineSnapshot(`
        {
          e15a9b2c408491a7de1e557f240fd9b97db3972f: {
            fields: [
              Query.hi,
            ],
            operation: {hi},
            operationName: anonymous,
          },
        }
      `);

        return true;
      })
      .reply(200);

    const testServer = new ApolloServer({
      typeDefs: /* GraphQL */ `
        type Query {
          hi: String
        }
      `,
      plugins: [
        useHive({
          token: 'token',
          selfHosting: {
            applicationUrl: 'http://localhost/foo',
            graphqlEndpoint: 'http://localhost/graphql',
            usageEndpoint: 'http://localhost/usage',
          },
          usage: {
            endpoint: 'http://localhost/usage',
            clientInfo() {
              return {
                name: 'brrr',
                version: '1',
              };
            },
          },
          enabled: true,
          debug: false,
          agent: {
            maxSize: 1,
            logger: createLogger(),
          },
        }),
      ],
    });

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        resolve();
      }, 1000);
      let requestCount = 0;

      graphqlScope.on('request', () => {
        requestCount = requestCount + 1;
        if (requestCount === 2) {
          clearTimeout(timeout);
          resolve();
        }
      });

      (async () => {
        const response = await testServer.executeOperation({
          query: '{hi}',
        });
        expect(response.body).toEqual({
          kind: 'single',
          singleResult: {
            data: {
              hi: null,
            },
            errors: undefined,
          },
        });
      })().catch(reject);
    });
    graphqlScope.done();
    await testServer.stop();
  });

  test('successful mutation operation is reported', async () => {
    const graphqlScope = nock('http://localhost')
      .post('/usage', body => {
        expect(body.map).toMatchInlineSnapshot(`
        {
          7ed6f1c2474785a05302bb92320b793f661d22d8: {
            fields: [
              Mutation.hi,
            ],
            operation: mutation{hi},
            operationName: anonymous,
          },
        }
      `);

        return true;
      })
      .reply(200);

    const testServer = new ApolloServer({
      typeDefs: /* GraphQL */ `
        type Query {
          hi: String
        }

        type Mutation {
          hi: String
        }
      `,
      plugins: [
        useHive({
          token: 'token',
          selfHosting: {
            applicationUrl: 'http://localhost/foo',
            graphqlEndpoint: 'http://localhost/graphql',
            usageEndpoint: 'http://localhost/usage',
          },
          usage: {
            endpoint: 'http://localhost/usage',
            clientInfo() {
              return {
                name: 'brrr',
                version: '1',
              };
            },
          },
          enabled: true,
          debug: false,
          agent: {
            maxSize: 1,
            logger: createLogger(),
          },
        }),
      ],
    });

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        resolve();
      }, 1000);
      let requestCount = 0;

      graphqlScope.on('request', () => {
        requestCount = requestCount + 1;
        if (requestCount === 2) {
          clearTimeout(timeout);
          resolve();
        }
      });

      (async () => {
        const response = await testServer.executeOperation({
          query: 'mutation{hi}',
        });
        expect(response.body).toEqual({
          kind: 'single',
          singleResult: {
            data: {
              hi: null,
            },
            errors: undefined,
          },
        });
      })().catch(reject);
    });

    graphqlScope.done();
    await testServer.stop();
  });

  test('operation error is reported', async () => {
    const graphqlScope = nock('http://localhost')
      .post('/usage', body => {
        expect(body.map).toMatchInlineSnapshot(`
          {
            e15a9b2c408491a7de1e557f240fd9b97db3972f: {
              fields: [
                Query.hi,
              ],
              operation: {hi},
              operationName: anonymous,
            },
          }
       `);

        expect(body.operations[0]).toMatchObject({
          execution: {
            errorsTotal: 1,
            ok: false,
          },
          metadata: {
            client: {
              name: 'brrr',
              version: '1',
            },
          },
          operationMapKey: 'e15a9b2c408491a7de1e557f240fd9b97db3972f',
        });

        return true;
      })
      .reply(200);

    const testServer = new ApolloServer({
      typeDefs: /* GraphQL */ `
        type Query {
          hi: String
        }
      `,
      resolvers: {
        Query: {
          hi: () => {
            throw new Error('nope.');
          },
        },
      },
      plugins: [
        useHive({
          token: 'token',
          selfHosting: {
            applicationUrl: 'http://localhost/foo',
            graphqlEndpoint: 'http://localhost/graphql',
            usageEndpoint: 'http://localhost/usage',
          },
          usage: {
            endpoint: 'http://localhost/usage',
            clientInfo() {
              return {
                name: 'brrr',
                version: '1',
              };
            },
          },
          enabled: true,
          debug: false,
          agent: {
            maxSize: 1,
            logger: createLogger(),
          },
        }),
      ],
    });

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        resolve();
      }, 1000);
      let requestCount = 0;

      graphqlScope.on('request', () => {
        requestCount = requestCount + 1;
        if (requestCount === 2) {
          clearTimeout(timeout);
          resolve();
        }
      });

      (async () => {
        const response = await testServer.executeOperation({
          query: '{hi}',
        });
        expect(response.body).toMatchObject({
          kind: 'single',
          singleResult: {
            data: {
              hi: null,
            },
            errors: [
              {
                message: 'nope.',
              },
            ],
          },
        });
      })().catch(reject);
    });

    graphqlScope.done();
    await testServer.stop();
  });

  test('custom client info based on context', async () => {
    const graphqlScope = nock('http://localhost')
      .post('/usage', body => {
        expect(body.map).toMatchInlineSnapshot(`
          {
            e15a9b2c408491a7de1e557f240fd9b97db3972f: {
              fields: [
                Query.hi,
              ],
              operation: {hi},
              operationName: anonymous,
            },
          }
        `);
        expect(body.operations[0]).toMatchObject({
          metadata: {
            client: {
              name: 'apollo-client',
              version: '4.2.0',
            },
          },
          operationMapKey: 'e15a9b2c408491a7de1e557f240fd9b97db3972f',
        });

        return true;
      })
      .reply(200);

    type ApolloServerContext = {
      req: IncomingMessage;
    };

    const testServer = new ApolloServer({
      typeDefs: /* GraphQL */ `
        type Query {
          hi: String
        }
      `,
      plugins: [
        useHive({
          token: 'token',
          selfHosting: {
            applicationUrl: 'http://localhost/foo',
            graphqlEndpoint: 'http://localhost/graphql',
            usageEndpoint: 'http://localhost/usage',
          },
          usage: {
            endpoint: 'http://localhost/usage',
          },
          enabled: true,
          debug: false,
          agent: {
            maxSize: 1,
            logger: createLogger(),
          },
        }),
      ],
    });

    const { url } = await startStandaloneServer(testServer, {
      async context({ req }): Promise<ApolloServerContext> {
        return { req };
      },
    });

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        resolve();
      }, 1000);
      let requestCount = 0;

      graphqlScope.on('request', () => {
        requestCount = requestCount + 1;
        if (requestCount === 2) {
          clearTimeout(timeout);
          resolve();
        }
      });

      (async () => {
        const response = await http.post(
          url,
          JSON.stringify({
            query: '{hi}',
          }),
          {
            headers: {
              'Content-Type': 'application/json',
              'x-graphql-client-version': '4.2.0',
              'x-graphql-client-name': 'apollo-client',
            },
          },
        );

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({
          data: {
            hi: null,
          },
          errors: undefined,
        });
      })().catch(reject);
    });

    graphqlScope.done();
    await testServer.stop();
  });

  test('operation with non-existing field is handled gracefully', async ({ expect }) => {
    const testServer = new ApolloServer({
      typeDefs: /* GraphQL */ `
        type Query {
          hi: String
        }
      `,
      plugins: [
        useHive({
          token: 'token',
          selfHosting: {
            applicationUrl: 'http://localhost/foo',
            graphqlEndpoint: 'http://localhost/graphql',
            usageEndpoint: 'http://localhost/usage',
          },
          usage: {
            endpoint: 'http://localhost/usage',
          },
          enabled: true,
          debug: false,
          agent: {
            maxSize: 1,
            logger: createLogger(),
          },
        }),
      ],
    });

    const response = await testServer.executeOperation({
      query: '{hello}',
    });

    expect(response.http.status).toBe(400);
    expect(response.body).toMatchObject({
      singleResult: {
        errors: [
          {
            message: 'Cannot query field "hello" on type "Query".',
          },
        ],
      },
    });
    await testServer.stop();
  });
});

describe('graphql-ws usage reporting setup', async () => {
  test('usage reporting for query', async () => {
    const graphqlScope = nock('http://localhost')
      .post('/usage', body => {
        expect(body.map).toMatchInlineSnapshot(`
          {
            f25063b60ab942d0c0d14cdd9cd3172de2e7ebc4: {
              fields: [
                Query.hi,
              ],
              operation: {hi},
              operationName: anonymous,
            },
          }
        `);
        expect(body.operations[0]).toMatchObject({
          metadata: {
            client: {
              name: 'apollo-ws-client',
              version: '1.0.0',
            },
          },
          operationMapKey: 'f25063b60ab942d0c0d14cdd9cd3172de2e7ebc4',
        });

        return true;
      })
      .reply(200);

    let httpServer: Server | undefined;
    try {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          resolve();
        }, 1000);
        let requestCount = 0;
        graphqlScope.on('request', () => {
          requestCount = requestCount + 1;
          if (requestCount === 2) {
            clearTimeout(timeout);
            resolve();
          }
        });

        (async () => {
          const schema = makeExecutableSchema({
            typeDefs: /* GraphQL */ `
              type Query {
                hi: String
              }
            `,
          });

          const app = express();
          httpServer = createServer(app);
          const wsServer = new WebSocketServer({
            server: httpServer,
            path: '/graphql',
          });

          const hiveClient = createHive({
            token: 'token',
            selfHosting: {
              applicationUrl: 'http://localhost/foo',
              graphqlEndpoint: 'http://localhost/graphql',
              usageEndpoint: 'http://localhost/usage',
            },
            usage: {
              endpoint: 'http://localhost/usage',
            },
            enabled: true,
            debug: false,
            agent: {
              maxSize: 1,
              logger: createLogger(),
            },
          });

          const serverCleanup = useServer(
            {
              schema,
              execute: hiveClient.createInstrumentedExecute(execute),
              subscribe: hiveClient.createInstrumentedSubscribe(subscribe),
              context: ctx => ctx,
            },
            wsServer,
          );
          const server = new ApolloServer({
            schema,
            plugins: [
              useHive(hiveClient),
              // Proper shutdown for the HTTP server.
              ApolloServerPluginDrainHttpServer({ httpServer }),
              // Proper shutdown for the WebSocket server.
              {
                async serverWillStart() {
                  return {
                    async drainServer() {
                      await serverCleanup.dispose();
                    },
                  };
                },
              },
            ],
          });
          await server.start();
          app.use(
            '/graphql',
            bodyParser.json(),
            expressMiddleware(server, {
              context: async ({ req }) => ({ req }),
            }),
          );

          await new Promise<void>(resolve =>
            httpServer?.listen(() => {
              resolve();
            }),
          );

          const port = (httpServer.address() as any)?.port;

          const wsClient = createClient({
            url: `ws://localhost:${port}/graphql`,
            webSocketImpl: WebSocket,
            connectionParams: {
              client: {
                name: 'apollo-ws-client',
                version: '1.0.0',
              },
            },
          });

          const query = wsClient.iterate({
            query: '{ hi }',
          });

          await query.next();
          await query.return?.();
        })().catch(reject);
      });
    } finally {
      httpServer?.close();
    }
    graphqlScope.done();
  });
});
