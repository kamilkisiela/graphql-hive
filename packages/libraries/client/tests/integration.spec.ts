import { createServer } from 'node:http';
import { AddressInfo } from 'node:net';
import axios from 'axios';
/* eslint-disable-next-line import/no-extraneous-dependencies */
import { createSchema, createYoga } from 'graphql-yoga';
/* eslint-disable-next-line import/no-extraneous-dependencies */
import nock from 'nock';
// eslint-disable-next-line import/no-extraneous-dependencies
import { ApolloServer } from '@apollo/server';
/* eslint-disable-next-line import/no-extraneous-dependencies */
import { startStandaloneServer } from '@apollo/server/standalone';
import { createHive, hiveApollo, useHive } from '../src';
import { waitFor } from './test-utils';

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

describe('GraphQL Yoga', () => {
  test('should not interrupt the process', async () => {
    const logger = {
      error: vi.fn(),
      info: vi.fn(),
    };
    const clean = handleProcess();
    const hive = createHive({
      enabled: true,
      debug: true,
      token: 'my-token',
      agent: {
        maxRetries: 0,
        sendInterval: 100,
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
    });

    const yoga = createYoga({
      schema: createSchema({
        typeDefs,
        resolvers,
      }),
      plugins: [useHive(hive)],
      logging: false,
    });

    const server = createServer(yoga);

    async function stop() {
      await new Promise(resolve => server.close(resolve));
      await hive.dispose();
    }

    await new Promise<void>(resolve => server.listen(0, resolve));
    const port = (server.address() as AddressInfo).port;

    await axios
      .post(`http://localhost:${port}/graphql`, {
        query: /* GraphQL */ `
          {
            hello
          }
        `,
      })
      .catch(async error => {
        await stop();
        return Promise.reject(error);
      });

    await waitFor(300);
    await stop();
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('[hive][info] Error'));
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('[hive][reporting] Failed'));
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('[hive][usage] Failed'));
    clean();
  }, 1_000);

  test('should capture client name and version headers', async () => {
    const usageMock = nock('http://yoga.localhost')
      .post(
        '/usage',
        (body: {
          operations: [
            {
              metadata: {
                client?: {
                  name: string;
                  version: string;
                };
              };
            },
          ];
        }) => {
          return (
            body.operations[0].metadata.client?.name === 'vitest' &&
            body.operations[0].metadata.client?.version === '1.0.0'
          );
        },
      )
      .reply(200);
    const clean = handleProcess();
    const hive = createHive({
      enabled: true,
      debug: false,
      token: 'my-token',
      agent: {
        maxRetries: 0,
        sendInterval: 100,
        timeout: 50,
      },
      reporting: false,
      usage: {
        endpoint: 'http://yoga.localhost/usage',
      },
    });

    const yoga = createYoga({
      schema: createSchema({
        typeDefs,
        resolvers,
      }),
      plugins: [useHive(hive)],
      logging: false,
    });

    const server = createServer(yoga);

    async function stop() {
      await new Promise(resolve => server.close(resolve));
      await hive.dispose();
    }

    await new Promise<void>(resolve => server.listen(0, resolve));
    const port = (server.address() as AddressInfo).port;

    await axios
      .post(
        `http://localhost:${port}/graphql`,
        {
          query: /* GraphQL */ `
            {
              hello
            }
          `,
        },
        {
          headers: {
            'x-graphql-client-name': 'vitest',
            'x-graphql-client-version': '1.0.0',
          },
        },
      )
      .catch(async error => {
        await stop();
        return Promise.reject(error);
      });

    await waitFor(300);
    await stop();
    clean();
    usageMock.done();
  }, 1_000);
});

describe('Apollo Server', () => {
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
        hiveApollo({
          enabled: true,
          debug: true,
          token: 'my-token',
          agent: {
            maxRetries: 0,
            sendInterval: 100,
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
    await waitFor(300);
    await apollo.stop();
    clean();
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('[hive][info]'));
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('[hive][usage]'));
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('[hive][reporting]'));
  }, 1_000);

  test('should capture client name and version headers', async () => {
    const clean = handleProcess();
    const usageMock = nock('http://apollo.localhost')
      .post(
        '/usage',
        (body: {
          operations: [
            {
              metadata: {
                client?: {
                  name: string;
                  version: string;
                };
              };
            },
          ];
        }) => {
          return (
            body.operations[0].metadata.client?.name === 'vitest' &&
            body.operations[0].metadata.client?.version === '1.0.0'
          );
        },
      )
      .reply(200);
    const apollo = new ApolloServer({
      typeDefs,
      resolvers,
      plugins: [
        hiveApollo({
          enabled: true,
          debug: false,
          token: 'my-token',
          agent: {
            maxRetries: 0,
            sendInterval: 100,
            timeout: 50,
          },
          reporting: false,
          usage: {
            endpoint: 'http://apollo.localhost/usage',
          },
        }),
      ],
    });

    await startStandaloneServer(apollo, {
      listen: {
        port: 4000,
      },
    });

    await axios.post(
      'http://localhost:4000/graphql',
      {
        query: /* GraphQL */ `
          {
            hello
          }
        `,
      },
      {
        headers: {
          'x-graphql-client-name': 'vitest',
          'x-graphql-client-version': '1.0.0',
        },
      },
    );

    await waitFor(300);
    await apollo.stop();
    clean();
    usageMock.done();
  }, 1_000);
});
