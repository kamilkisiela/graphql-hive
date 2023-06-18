import { createServer } from 'node:http';
import { AddressInfo } from 'node:net';
import axios from 'axios';
/* eslint-disable-next-line import/no-extraneous-dependencies */
import { createSchema, createYoga } from 'graphql-yoga';
// eslint-disable-next-line import/no-extraneous-dependencies
import { ApolloServer } from '@apollo/server';
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

test('GraphQL Yoga - should not interrupt the process', async () => {
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
      maxRetries: 2,
      sendInterval: 1000,
      timeout: 1000,
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
    plugins: [useHive(hive) as any],
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

  await waitFor(5000);
  await stop();
  expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('[hive][info]'));
  expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('[hive][usage]'));
  expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('[hive][reporting]'));
  clean();
}, 10_000);

test('Apollo Server - should not interrupt the process', async () => {
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
          maxRetries: 2,
          sendInterval: 1000,
          timeout: 1000,
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
  await waitFor(5000);
  await apollo.stop();
  clean();
  expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('[hive][info]'));
  expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('[hive][usage]'));
  expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('[hive][reporting]'));
}, 10_000);
