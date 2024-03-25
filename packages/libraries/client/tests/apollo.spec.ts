/* eslint import/no-extraneous-dependencies: ["error", {"devDependencies": true}] */
import { createServer, IncomingMessage, Server } from 'http';
import bodyParser from 'body-parser';
import express from 'express';
import { execute, subscribe } from 'graphql';
import { createClient } from 'graphql-ws';
import { useServer } from 'graphql-ws/lib/use/ws';
import { createLogger } from 'graphql-yoga';
import nock from 'nock';
import { WebSocket, WebSocketServer } from 'ws';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { startStandaloneServer } from '@apollo/server/standalone';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { createHive, createSupergraphSDLFetcher, hiveApollo } from '../src';
import { version } from '../src/version';

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
      expect(err).toMatchInlineSnapshot(`[Error: Failed to fetch [500]]`);
    }
  });
});

describe('built-in HTTP usage reporting', async () => {
  test('successful query operation is reported', async () => {
    const graphqlScope = nock('http://localhost')
      .post('/graphql')
      .reply(200, {
        data: {
          __typename: 'Query',
          tokenInfo: {
            __typename: 'TokenInfo',
            token: {
              name: 'brrrt',
            },
            organization: {
              name: 'mom',
              cleanId: 'ur-mom',
            },
            project: {
              name: 'projecto',
              type: 'FEDERATION',
              cleanId: 'projecto',
            },
            target: {
              name: 'projecto',
              cleanId: 'projecto',
            },
            canReportSchema: true,
            canCollectUsage: true,
            canReadOperations: true,
          },
        },
      })
      .post('/usage', body => {
        expect(body.map).toMatchInlineSnapshot(`
        {
          046386c6981ae292daf3adc123d3b6b0: {
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
        hiveApollo({
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
  });

  test('successful mutation operation is reported', async () => {
    const graphqlScope = nock('http://localhost')
      .post('/graphql')
      .reply(200, {
        data: {
          __typename: 'Query',
          tokenInfo: {
            __typename: 'TokenInfo',
            token: {
              name: 'brrrt',
            },
            organization: {
              name: 'mom',
              cleanId: 'ur-mom',
            },
            project: {
              name: 'projecto',
              type: 'FEDERATION',
              cleanId: 'projecto',
            },
            target: {
              name: 'projecto',
              cleanId: 'projecto',
            },
            canReportSchema: true,
            canCollectUsage: true,
            canReadOperations: true,
          },
        },
      })
      .post('/usage', body => {
        expect(body.map).toMatchInlineSnapshot(`
        {
          5164dcbb81769931d535efca9e3e8fb5: {
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
        hiveApollo({
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
  });

  test('operation error is reported', async () => {
    const graphqlScope = nock('http://localhost')
      .post('/graphql')
      .reply(200, {
        data: {
          __typename: 'Query',
          tokenInfo: {
            __typename: 'TokenInfo',
            token: {
              name: 'brrrt',
            },
            organization: {
              name: 'mom',
              cleanId: 'ur-mom',
            },
            project: {
              name: 'projecto',
              type: 'FEDERATION',
              cleanId: 'projecto',
            },
            target: {
              name: 'projecto',
              cleanId: 'projecto',
            },
            canReportSchema: true,
            canCollectUsage: true,
            canReadOperations: true,
          },
        },
      })
      .post('/usage', body => {
        expect(body.map).toMatchInlineSnapshot(`
          {
            046386c6981ae292daf3adc123d3b6b0: {
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
          operationMapKey: '046386c6981ae292daf3adc123d3b6b0',
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
        hiveApollo({
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
  });

  test('custom client info based on context', async () => {
    const graphqlScope = nock('http://localhost')
      .post('/graphql')
      .reply(200, {
        data: {
          __typename: 'Query',
          tokenInfo: {
            __typename: 'TokenInfo',
            token: {
              name: 'brrrt',
            },
            organization: {
              name: 'mom',
              cleanId: 'ur-mom',
            },
            project: {
              name: 'projecto',
              type: 'FEDERATION',
              cleanId: 'projecto',
            },
            target: {
              name: 'projecto',
              cleanId: 'projecto',
            },
            canReportSchema: true,
            canCollectUsage: true,
            canReadOperations: true,
          },
        },
      })
      .post('/usage', body => {
        expect(body.map).toMatchInlineSnapshot(`
          {
            046386c6981ae292daf3adc123d3b6b0: {
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
          operationMapKey: '046386c6981ae292daf3adc123d3b6b0',
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
        hiveApollo({
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
            logger: createLogger('silent'),
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
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-graphql-client-version': '4.2.0',
            'x-graphql-client-name': 'apollo-client',
          },
          body: JSON.stringify({
            query: '{hi}',
          }),
        });

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
  });
});

describe('graphql-ws usage reporting setup', async () => {
  test('usage reporting for query', async () => {
    const graphqlScope = nock('http://localhost')
      .post('/graphql')
      .reply(200, {
        data: {
          __typename: 'Query',
          tokenInfo: {
            __typename: 'TokenInfo',
            token: {
              name: 'brrrt',
            },
            organization: {
              name: 'mom',
              cleanId: 'ur-mom',
            },
            project: {
              name: 'projecto',
              type: 'FEDERATION',
              cleanId: 'projecto',
            },
            target: {
              name: 'projecto',
              cleanId: 'projecto',
            },
            canReportSchema: true,
            canCollectUsage: true,
            canReadOperations: true,
          },
        },
      })
      .post('/usage', body => {
        expect(body.map).toMatchInlineSnapshot(`
          {
            0063ba7bf2695b896c464057aef29cdc: {
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
          operationMapKey: '0063ba7bf2695b896c464057aef29cdc',
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
              logger: createLogger('silent'),
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
              hiveApollo(hiveClient),
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
