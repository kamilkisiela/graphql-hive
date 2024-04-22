/* eslint-disable-next-line import/no-extraneous-dependencies */
import { createSchema, createYoga } from 'graphql-yoga';
// eslint-disable-next-line import/no-extraneous-dependencies
import { ApolloServer } from '@apollo/server';
/* eslint-disable-next-line import/no-extraneous-dependencies */
import { startStandaloneServer } from '@apollo/server/standalone';
import { Response } from '@whatwg-node/fetch';
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
    });

    const yoga = createYoga({
      schema: createSchema({
        typeDefs,
        resolvers,
      }),
      plugins: [useHive(hive)],
      logging: false,
    });

    await yoga.fetch(
      new Request('http://localhost/graphql', {
        method: 'POST',
        body: JSON.stringify({
          query: /* GraphQL */ `
            {
              hello
            }
          `,
        }),
        headers: {
          'content-type': 'application/json',
        },
      }),
    );

    await waitFor(50);

    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('[hive][info] Error'));
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('[hive][reporting] Failed'));
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('[hive][usage] Failed'));
    await hive.dispose();
    clean();
  }, 1_000);

  test('should capture client name and version headers', async () => {
    const fetchSpy = vi.fn<[RequestInfo | URL, options: RequestInit | undefined]>(async () =>
      Response.json({}, { status: 200 }),
    );
    const clean = handleProcess();
    const hive = createHive({
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
        endpoint: 'http://yoga.localhost:4200/usage',
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

    await yoga.fetch(`http://localhost/graphql`, {
      method: 'POST',
      body: JSON.stringify({
        query: /* GraphQL */ `
          {
            hello
          }
        `,
      }),
      headers: {
        'content-type': 'application/json',
        'x-graphql-client-name': 'vitest',
        'x-graphql-client-version': '1.0.0',
      },
    });

    await waitFor(50);
    await hive.dispose();
    clean();
    expect(fetchSpy).toHaveBeenCalledWith(
      'http://yoga.localhost:4200/usage',
      expect.objectContaining({
        body: expect.stringContaining('"client":{"name":"vitest","version":"1.0.0"}'),
      }),
    );
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
        hiveApollo({
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

    await startStandaloneServer(apollo, {
      listen: {
        port: 4000,
      },
    });

    await fetch('http://localhost:4000/graphql', {
      method: 'POST',
      body: JSON.stringify({
        query: /* GraphQL */ `
          {
            hello
          }
        `,
      }),
      headers: {
        'content-type': 'application/json',
        'x-graphql-client-name': 'vitest',
        'x-graphql-client-version': '1.0.0',
      },
    });

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
});
