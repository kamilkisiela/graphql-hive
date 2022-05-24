/* eslint-disable-next-line import/no-extraneous-dependencies */
import { createServer } from '@graphql-yoga/node';
/* eslint-disable-next-line import/no-extraneous-dependencies */
import { ApolloServerBase } from 'apollo-server-core';
import axios from 'axios';
import { createHive, useHive, hiveApollo } from '../src';
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
    error: jest.fn(),
    info: jest.fn(),
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

  const server = createServer({
    port: 3000,
    schema: {
      typeDefs,
      resolvers,
    },
    plugins: [useHive(hive) as any],
    logging: false,
  });

  async function stop() {
    await server.stop();
    await hive.dispose();
  }

  await server.start();

  await axios
    .post('http://localhost:3000/graphql', {
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

  await waitFor(5_000);
  await stop();
  expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('[hive][info]'));
  expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('[hive][usage]'));
  expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('[hive][reporting]'));
  clean();
}, 10_000);

test('Apollo Server - should not interrupt the process', async () => {
  const logger = {
    error: jest.fn(),
    info: jest.fn(),
  };
  const clean = handleProcess();
  const apollo = new ApolloServerBase({
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

  await apollo.start();
  await apollo.executeOperation({
    query: /* GraphQL */ `
      {
        hello
      }
    `,
  });
  await waitFor(5_000);
  await apollo.stop();
  clean();
  expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('[hive][info]'));
  expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('[hive][usage]'));
  expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('[hive][reporting]'));
}, 10_000);
