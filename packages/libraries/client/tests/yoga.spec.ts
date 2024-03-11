import { createServer } from 'node:http';
import axios from 'axios';
import { GraphQLError } from 'graphql';
import { createClient } from 'graphql-ws';
import { useServer as useWSServer } from 'graphql-ws/lib/use/ws';
// eslint-disable-next-line import/no-extraneous-dependencies
import { createLogger, createSchema, createYoga } from 'graphql-yoga';
// eslint-disable-next-line import/no-extraneous-dependencies
import nock from 'nock';
import { WebSocket, WebSocketServer } from 'ws';
// eslint-disable-next-line import/no-extraneous-dependencies
import { useDisableIntrospection } from '@graphql-yoga/plugin-disable-introspection';
import { useGraphQLSSE } from '@graphql-yoga/plugin-graphql-sse';
// eslint-disable-next-line import/no-extraneous-dependencies
import { useResponseCache } from '@graphql-yoga/plugin-response-cache';
import { useHive } from '../src/yoga.js';

beforeAll(() => {
  nock.cleanAll();
});

it('reports usage', async () => {
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
        debug: true,
        token: 'brrrt',
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
        agent: {
          maxSize: 1,
        },
      }),
    ],
  });

  // eslint-disable-next-line no-async-promise-executor
  await new Promise<void>(async resolve => {
    const res = await yoga.fetch('http://localhost/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `{ hi }`,
      }),
    });
    expect(res.status).toBe(200);
    expect(await res.text()).toMatchInlineSnapshot('{"data":{"hi":null}}');

    setTimeout(() => {
      graphqlScope.done();
      resolve();
    }, 1000);
  });
});

it('reports usage with response cache', async () => {
  axios.interceptors.request.use(config => {
    console.log(config.url);
    return config;
  });
  let usageCount = 0;
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
      usageCount++;
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

      return true;
    })
    .thrice()
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
      useResponseCache({
        session: () => null,
        ttl: Infinity,
      }),
      useHive({
        enabled: true,
        debug: true,
        token: 'brrrt',
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
        agent: {
          maxSize: 1,
        },
      }),
    ],
  });
  // eslint-disable-next-line no-async-promise-executor
  await new Promise<void>(async resolve => {
    for (const _ of [1, 2, 3]) {
      const res = await yoga.fetch('http://localhost/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `{ hi }`,
        }),
      });
      expect(res.status).toBe(200);
      expect(await res.text()).toEqual('{"data":{"hi":null}}');
    }

    setTimeout(() => {
      graphqlScope.done();
      expect(usageCount).toEqual(3);
      resolve();
    }, 1000);
  });
});

it('does not report usage for operation that does not pass validation', async () => {
  const callback = vi.fn();
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
      useDisableIntrospection(),
      useHive({
        enabled: true,
        debug: true,
        token: 'brrrt',
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
        agent: {
          maxSize: 1,
        },
      }),
    ],
  });

  // eslint-disable-next-line no-async-promise-executor
  await new Promise<void>(async (resolve, reject) => {
    nock.emitter.once('no match', (req: any) => {
      reject(new Error(`Unexpected request was sent to ${req.path}`));
    });

    const res = await yoga.fetch('http://localhost/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: /* GraphQL */ `
          {
            __schema {
              types {
                name
              }
            }
          }
        `,
      }),
    });
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('GraphQL introspection has been disabled');

    setTimeout(() => {
      graphqlScope.done();
      expect(callback).not.toHaveBeenCalled();
      resolve();
    }, 1000);
  });
});

it('does not report usage if context creating raises an error', async () => {
  const callback = vi.fn();
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
      {
        onContextBuilding() {
          throw new GraphQLError('Not authenticated.');
        },
      },
      useHive({
        enabled: true,
        debug: true,
        token: 'brrrt',
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
        agent: {
          maxSize: 1,
        },
      }),
    ],
  });

  // eslint-disable-next-line no-async-promise-executor
  await new Promise<void>(async (resolve, reject) => {
    nock.emitter.once('no match', (req: any) => {
      reject(new Error(`Unexpected request was sent to ${req.path}`));
    });

    const res = await yoga.fetch('http://localhost/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: /* GraphQL */ `
          {
            hi
          }
        `,
      }),
    });
    expect(res.status).toBe(200);
    expect(await res.text()).toMatchInlineSnapshot(`{"errors":[{"message":"Not authenticated."}]}`);

    setTimeout(() => {
      graphqlScope.done();
      expect(callback).not.toHaveBeenCalled();
      resolve();
    }, 1000);
  });
});

describe('subscription reporting', () => {
  describe('built-in see', () => {
    it('reports usage for successful subscription operation', async () => {
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
            c6cc5505189a301dcadc408034c21a2d: {
              fields: [
                Subscription.hi,
              ],
              operation: subscription{hi},
              operationName: anonymous,
            },
          }
        `);

          return true;
        })
        .reply(200);

      const yoga = createYoga({
        logging: false,
        schema: createSchema({
          typeDefs: /* GraphQL */ `
            type Query {
              hii: String
            }

            type Subscription {
              hi: String
            }
          `,
          resolvers: {
            Subscription: {
              hi: {
                async *subscribe() {
                  return;
                },
              },
            },
          },
        }),
        plugins: [
          useDisableIntrospection(),
          useHive({
            enabled: true,
            debug: false,
            token: 'brrrt',
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
            agent: {
              maxSize: 1,
              logger: createLogger('silent'),
            },
          }),
        ],
      });

      // eslint-disable-next-line no-async-promise-executor
      await new Promise<void>(async resolve => {
        const res = await yoga.fetch('http://localhost/graphql', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: `subscription { hi }`,
          }),
        });
        expect(res.status).toBe(200);
        expect(await res.text()).toMatchInlineSnapshot(`
          :

          event: complete
        `);

        let timeout = setTimeout(() => {
          graphqlScope.done();
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
      });
    });

    it('reports usage for failed subscription operation', async () => {
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
            c6cc5505189a301dcadc408034c21a2d: {
              fields: [
                Subscription.hi,
              ],
              operation: subscription{hi},
              operationName: anonymous,
            },
          }
        `);

          expect(body).toMatchObject({
            operations: [
              {
                execution: {
                  ok: false,
                  duration: expect.any(Number),
                  errorsTotal: 1,
                  errors: [{ message: 'Oof' }],
                },
              },
            ],
          });

          return true;
        })
        .reply(200);

      const yoga = createYoga({
        logging: false,
        schema: createSchema({
          typeDefs: /* GraphQL */ `
            type Query {
              hii: String
            }

            type Subscription {
              hi: String
            }
          `,
          resolvers: {
            Subscription: {
              hi: {
                async *subscribe() {
                  throw new Error('Oof');
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
            agent: {
              maxSize: 1,
              logger: createLogger('silent'),
            },
          }),
        ],
      });

      // eslint-disable-next-line no-async-promise-executor
      await new Promise<void>(async resolve => {
        const res = await yoga.fetch('http://localhost/graphql', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: `subscription { hi }`,
          }),
        });
        expect(res.status).toBe(200);
        expect(await res.text()).toMatchInlineSnapshot(`
          :

          event: next
          data: {"errors":[{"message":"Unexpected error.","locations":[{"line":1,"column":1}]}]}

          event: complete
        `);

        let timeout = setTimeout(() => {
          graphqlScope.done();
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
      });
    });
  });

  describe('@graphql-yoga/plugin-graphql-sse (distinct connection mode)', async () => {
    it('reports usage for successful subscription operation', async () => {
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
            c6cc5505189a301dcadc408034c21a2d: {
              fields: [
                Subscription.hi,
              ],
              operation: subscription{hi},
              operationName: anonymous,
            },
          }
        `);

          return true;
        })
        .reply(200);

      const yoga = createYoga({
        logging: false,
        schema: createSchema({
          typeDefs: /* GraphQL */ `
            type Query {
              hii: String
            }

            type Subscription {
              hi: String
            }
          `,
          resolvers: {
            Subscription: {
              hi: {
                async *subscribe() {
                  return;
                },
              },
            },
          },
        }),
        plugins: [
          useGraphQLSSE(),
          useHive({
            enabled: true,
            debug: false,
            token: 'brrrt',
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
            agent: {
              maxSize: 1,
              logger: createLogger('silent'),
            },
          }),
        ],
      });

      // eslint-disable-next-line no-async-promise-executor
      await new Promise<void>(async resolve => {
        const url = new URL('http://localhost/graphql/stream');
        url.searchParams.set('query', 'subscription { hi }');
        const res = await yoga.fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'text/event-stream',
            accept: 'text/event-stream',
          },
        });

        expect(res.status).toBe(200);
        expect(await res.text()).toMatchInlineSnapshot(`
          :

          event: complete
          data:
        `);

        let timeout = setTimeout(() => {
          graphqlScope.done();
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
      });
    });

    it('reports usage for failed subscription operation', async () => {
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
            c6cc5505189a301dcadc408034c21a2d: {
              fields: [
                Subscription.hi,
              ],
              operation: subscription{hi},
              operationName: anonymous,
            },
          }
        `);

          expect(body).toMatchObject({
            operations: [
              {
                execution: {
                  ok: false,
                  duration: expect.any(Number),
                  errorsTotal: 1,
                  errors: [{ message: 'Oof' }],
                },
              },
            ],
          });

          return true;
        })
        .reply(200);

      const yoga = createYoga({
        logging: false,
        schema: createSchema({
          typeDefs: /* GraphQL */ `
            type Query {
              hii: String
            }

            type Subscription {
              hi: String
            }
          `,
          resolvers: {
            Subscription: {
              hi: {
                async *subscribe() {
                  throw new Error('Oof');
                },
              },
            },
          },
        }),
        plugins: [
          useGraphQLSSE(),
          useHive({
            enabled: true,
            debug: false,
            token: 'brrrt',
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
            agent: {
              maxSize: 1,
              logger: createLogger('silent'),
            },
          }),
        ],
      });

      // eslint-disable-next-line no-async-promise-executor
      await new Promise<void>(async resolve => {
        const url = new URL('http://localhost/graphql/stream');
        url.searchParams.set('query', 'subscription { hi }');
        const res = await yoga.fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'text/event-stream',
            accept: 'text/event-stream',
          },
        });
        expect(res.status).toBe(200);
        expect(await res.text()).toMatchInlineSnapshot(`
          :

          event: next
          data: {"errors":[{"message":"Unexpected error.","locations":[{"line":1,"column":1}],"extensions":{"unexpected":true}}]}

          event: complete
          data:
        `);

        let timeout = setTimeout(() => {
          graphqlScope.done();
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
      });
    });
  });

  describe('graphql-ws', async () => {
    it('reports usage for successful subscription operation', async () => {
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
          c6cc5505189a301dcadc408034c21a2d: {
            fields: [
              Subscription.hi,
            ],
            operation: subscription{hi},
            operationName: anonymous,
          },
        }
      `);

          return true;
        })
        .reply(200);

      const yoga = createYoga({
        logging: false,
        schema: createSchema({
          typeDefs: /* GraphQL */ `
            type Query {
              hii: String
            }

            type Subscription {
              hi: String
            }
          `,
          resolvers: {
            Subscription: {
              hi: {
                async *subscribe() {
                  return;
                },
              },
            },
          },
        }),
        plugins: [
          useGraphQLSSE(),
          useHive({
            enabled: true,
            debug: false,
            token: 'brrrt',
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
            agent: {
              maxSize: 1,
              logger: createLogger('silent'),
            },
          }),
        ],
      });
      const httpServer = createServer(yoga);
      const wsServer = new WebSocketServer({
        server: httpServer,
        path: yoga.graphqlEndpoint,
      });
      useWSServer(
        {
          execute: (args: any) => args.rootValue.execute(args),
          subscribe: (args: any) => args.rootValue.subscribe(args),
          onSubscribe: async (ctx, msg) => {
            const { schema, execute, subscribe, contextFactory, parse, validate } =
              yoga.getEnveloped({
                ...ctx,
                req: ctx.extra.request,
                socket: ctx.extra.socket,
                params: msg.payload,
              });

            const args = {
              schema,
              operationName: msg.payload.operationName,
              document: parse(msg.payload.query),
              variableValues: msg.payload.variables,
              contextValue: await contextFactory(),
              rootValue: {
                execute,
                subscribe,
              },
            };

            const errors = validate(args.schema, args.document);
            if (errors.length) return errors;
            return args;
          },
        },
        wsServer,
      );

      await new Promise<void>(resolve => {
        httpServer.listen(() => {
          resolve();
        });
      });

      const port = (httpServer.address() as any).port as number;
      const client = createClient({
        url: `ws://localhost:${port}${yoga.graphqlEndpoint}`,
        webSocketImpl: WebSocket,
      });

      const query = client.iterate({
        query: 'subscription { hi }',
      });

      const { done } = await query.next();
      expect(done).toEqual(true);

      await new Promise<void>(resolve => {
        let timeout = setTimeout(() => {
          graphqlScope.done();
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
      });
      await new Promise<void>(resolve => {
        httpServer.close(() => {
          resolve();
        });
      });
    });
    it('reports usage for failed subscription operation', async () => {
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
          c6cc5505189a301dcadc408034c21a2d: {
            fields: [
              Subscription.hi,
            ],
            operation: subscription{hi},
            operationName: anonymous,
          },
        }
      `);

          expect(body).toMatchObject({
            operations: [
              {
                execution: {
                  ok: false,
                  duration: expect.any(Number),
                  errorsTotal: 1,
                  errors: [{ message: 'Oof' }],
                },
              },
            ],
          });

          return true;
        })
        .reply(200);

      const yoga = createYoga({
        logging: false,
        schema: createSchema({
          typeDefs: /* GraphQL */ `
            type Query {
              hii: String
            }

            type Subscription {
              hi: String
            }
          `,
          resolvers: {
            Subscription: {
              hi: {
                async *subscribe() {
                  throw new Error('Oof');
                },
              },
            },
          },
        }),
        plugins: [
          useGraphQLSSE(),
          useHive({
            enabled: true,
            debug: false,
            token: 'brrrt',
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
            agent: {
              maxSize: 1,
              logger: createLogger('silent'),
            },
          }),
        ],
      });
      const httpServer = createServer(yoga);
      const wsServer = new WebSocketServer({
        server: httpServer,
        path: yoga.graphqlEndpoint,
      });
      useWSServer(
        {
          execute: (args: any) => args.rootValue.execute(args),
          subscribe: (args: any) => args.rootValue.subscribe(args),
          onSubscribe: async (ctx, msg) => {
            const { schema, execute, subscribe, contextFactory, parse, validate } =
              yoga.getEnveloped({
                ...ctx,
                req: ctx.extra.request,
                socket: ctx.extra.socket,
                params: msg.payload,
              });

            const args = {
              schema,
              operationName: msg.payload.operationName,
              document: parse(msg.payload.query),
              variableValues: msg.payload.variables,
              contextValue: await contextFactory(),
              rootValue: {
                execute,
                subscribe,
              },
            };

            const errors = validate(args.schema, args.document);
            if (errors.length) return errors;
            return args;
          },
        },
        wsServer,
      );

      await new Promise<void>(resolve => {
        httpServer.listen(() => {
          resolve();
        });
      });

      const port = (httpServer.address() as any).port as number;
      const client = createClient({
        url: `ws://localhost:${port}${yoga.graphqlEndpoint}`,
        webSocketImpl: WebSocket,
      });

      const query = client.iterate({
        query: 'subscription { hi }',
      });

      const { value } = await query.next();
      expect(value).toMatchInlineSnapshot(`
        {
          errors: [
            {
              extensions: {
                unexpected: true,
              },
              locations: [
                {
                  column: 1,
                  line: 1,
                },
              ],
              message: Unexpected error.,
            },
          ],
        }
      `);

      await new Promise<void>(resolve => {
        let timeout = setTimeout(() => {
          graphqlScope.done();
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
      });
      await new Promise<void>(resolve => {
        httpServer.close(() => {
          resolve();
        });
      });
    });
  });
});
