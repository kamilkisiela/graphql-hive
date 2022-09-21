import { buildSchema, parse } from 'graphql';
// eslint-disable-next-line import/no-extraneous-dependencies
import nock from 'nock';
// eslint-disable-next-line import/no-extraneous-dependencies
import { buildSubgraphSchema } from '@apollo/federation';
import { createHive } from '../src/client';
import { version } from '../src/version';
import { waitFor } from './test-utils';

afterEach(() => {
  nock.cleanAll();
});

const headers = {
  'Content-Type': 'application/json',
  'graphql-client-name': 'Hive Client',
  'graphql-client-version': version,
};

test('should not leak the exception', async () => {
  const logger = {
    error: jest.fn(),
    info: jest.fn(),
  };

  const hive = createHive({
    enabled: true,
    debug: true,
    agent: {
      timeout: 500,
      maxRetries: 1,
      logger,
    },
    token: 'Token',
    reporting: {
      author: 'Test',
      commit: 'Commit',
      endpoint: 'http://127.0.0.1:55404',
    },
  });

  hive.reportSchema({
    schema: buildSchema(/* GraphQL */ `
      type Query {
        foo: String
      }
    `),
  });

  await waitFor(2000);
  await hive.dispose();

  expect(logger.info).toHaveBeenCalledWith('[hive][reporting] Sending (queue 1) (attempt 1)');
  expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('[hive][reporting] Attempt 1 failed:'));
  expect(logger.info).toHaveBeenCalledWith('[hive][reporting] Sending (queue 1) (attempt 2)');
  expect(logger.error).toHaveBeenCalledTimes(1);
  expect(logger.error).toHaveBeenCalledWith(
    expect.stringContaining(`[hive][reporting] Failed to report schema: connect ECONNREFUSED 127.0.0.1:55404`)
  );
});

test('should send data to Hive', async () => {
  const logger = {
    error: jest.fn(),
    info: jest.fn(),
  };

  const author = 'Test';
  const commit = 'Commit';
  const token = 'Token';
  const serviceUrl = 'https://api.com';
  const serviceName = 'my-api';

  let body: any = {};
  const http = nock('http://localhost')
    .post('/200')
    .matchHeader('Authorization', `Bearer ${token}`)
    .matchHeader('Content-Type', headers['Content-Type'])
    .matchHeader('graphql-client-name', headers['graphql-client-name'])
    .matchHeader('graphql-client-version', headers['graphql-client-version'])
    .once()
    .reply((_, _body) => {
      body = _body;
      return [
        200,
        {
          data: {
            schemaPublish: {
              __typename: 'SchemaPublishSuccess',
              initial: false,
              valid: true,
            },
          },
        },
      ];
    });

  const hive = createHive({
    enabled: true,
    debug: true,
    agent: {
      timeout: 500,
      maxRetries: 1,
      logger,
    },
    token,
    reporting: {
      author,
      commit,
      endpoint: 'http://localhost/200',
      serviceUrl,
      serviceName,
    },
  });

  hive.reportSchema({
    schema: buildSchema(/* GraphQL */ `
      type Query {
        foo: String
      }
    `),
  });

  await waitFor(2000);
  await hive.dispose();
  http.done();

  expect(logger.error).not.toHaveBeenCalled();
  expect(logger.info).toHaveBeenCalledWith('[hive][reporting] Sending (queue 1) (attempt 1)');
  expect(logger.info).toHaveBeenCalledWith(`[hive][reporting] Sent!`);

  expect(body.variables.input.sdl).toBe(`type Query{foo:String}`);
  expect(body.variables.input.author).toBe(author);
  expect(body.variables.input.commit).toBe(commit);
  expect(body.variables.input.service).toBe(serviceName);
  expect(body.variables.input.url).toBe(serviceUrl);
  expect(body.variables.input.force).toBe(true);
});

test('should send data to Hive immediately', async () => {
  const logger = {
    error: jest.fn(),
    info: jest.fn(),
  };

  const author = 'Test';
  const commit = 'Commit';
  const token = 'Token';
  const serviceUrl = 'https://api.com';
  const serviceName = 'my-api';

  let body: any = {};
  const http = nock('http://localhost')
    .post('/200')
    .matchHeader('Authorization', `Bearer ${token}`)
    .matchHeader('Content-Type', headers['Content-Type'])
    .matchHeader('graphql-client-name', headers['graphql-client-name'])
    .matchHeader('graphql-client-version', headers['graphql-client-version'])
    .once()
    .reply((_, _body) => {
      body = _body;
      return [
        200,
        {
          data: {
            schemaPublish: {
              __typename: 'SchemaPublishSuccess',
              initial: false,
              valid: true,
              successMessage: 'Successfully published schema',
            },
          },
        },
      ];
    });

  const hive = createHive({
    enabled: true,
    debug: true,
    agent: {
      timeout: 500,
      maxRetries: 1,
      logger,
      sendInterval: 200,
    },
    token,
    reporting: {
      author,
      commit,
      endpoint: 'http://localhost/200',
      serviceUrl,
      serviceName,
    },
  });

  hive.reportSchema({
    schema: buildSchema(/* GraphQL */ `
      type Query {
        foo: String
      }
    `),
  });

  expect(logger.error).not.toHaveBeenCalled();
  expect(logger.info).toHaveBeenCalledWith('[hive][reporting] Sending immediately');
  expect(logger.info).toHaveBeenCalledTimes(1);
  await waitFor(50);
  expect(logger.info).toHaveBeenCalledWith('[hive][reporting] Sending (queue 1) (attempt 1)');
  expect(logger.error).not.toHaveBeenCalled();
  expect(logger.info).toHaveBeenCalledWith(`[hive][reporting] Sent!`);
  expect(logger.info).toHaveBeenCalledWith(`[hive][reporting] Successfully published schema`);
  expect(logger.info).toHaveBeenCalledTimes(4);

  expect(body.variables.input.sdl).toBe(`type Query{foo:String}`);
  expect(body.variables.input.author).toBe(author);
  expect(body.variables.input.commit).toBe(commit);
  expect(body.variables.input.service).toBe(serviceName);
  expect(body.variables.input.url).toBe(serviceUrl);
  expect(body.variables.input.force).toBe(true);

  await waitFor(400);
  expect(logger.info).toHaveBeenCalledTimes(4);

  await hive.dispose();
  http.done();
});

test('should send original schema of a federated service', async () => {
  const logger = {
    error: jest.fn(),
    info: jest.fn(),
  };

  const author = 'Test';
  const commit = 'Commit';
  const token = 'Token';
  const serviceUrl = 'https://api.com';
  const serviceName = 'my-api';

  const hive = createHive({
    enabled: true,
    debug: true,
    agent: {
      timeout: 500,
      maxRetries: 1,
      logger,
    },
    token,
    reporting: {
      author,
      commit,
      endpoint: 'http://localhost/200',
      serviceUrl,
      serviceName,
    },
  });

  let body: any = {};
  const http = nock('http://localhost')
    .post('/200')
    .matchHeader('Authorization', `Bearer ${token}`)
    .matchHeader('Content-Type', headers['Content-Type'])
    .matchHeader('graphql-client-name', headers['graphql-client-name'])
    .matchHeader('graphql-client-version', headers['graphql-client-version'])
    .once()
    .reply((_, _body) => {
      body = _body;
      return [200];
    });

  hive.reportSchema({
    schema: buildSubgraphSchema(
      parse(/* GraphQL */ `
        type Query {
          bar: String
        }
      `)
    ),
  });

  await hive.dispose();
  http.done();

  expect(body.variables.input.sdl).toBe(`type Query{bar:String}`);
  expect(body.variables.input.author).toBe(author);
  expect(body.variables.input.commit).toBe(commit);
  expect(body.variables.input.service).toBe(serviceName);
  expect(body.variables.input.url).toBe(serviceUrl);
  expect(body.variables.input.force).toBe(true);
});

test('should display SchemaPublishMissingServiceError', async () => {
  const logger = {
    error: jest.fn(),
    info: jest.fn(),
  };

  const token = 'Token';
  const http = nock('http://localhost')
    .post('/200')
    .matchHeader('Authorization', `Bearer ${token}`)
    .matchHeader('Content-Type', headers['Content-Type'])
    .matchHeader('graphql-client-name', headers['graphql-client-name'])
    .matchHeader('graphql-client-version', headers['graphql-client-version'])
    .once()
    .reply((_, _body) => {
      return [
        200,
        {
          data: {
            schemaPublish: {
              __typename: 'SchemaPublishMissingServiceError',
              missingServiceError: 'Service name is required',
            },
          },
        },
      ];
    });

  const hive = createHive({
    enabled: true,
    debug: true,
    agent: {
      timeout: 500,
      maxRetries: 1,
      logger,
    },
    token: token,
    reporting: {
      author: 'Test',
      commit: 'Commit',
      endpoint: 'http://localhost/200',
    },
  });

  hive.reportSchema({
    schema: buildSchema(/* GraphQL */ `
      type Query {
        foo: String
      }
    `),
  });

  await waitFor(50);
  await hive.dispose();
  http.done();

  expect(logger.info).toHaveBeenCalledWith('[hive][reporting] Sending (queue 1) (attempt 1)');
  expect(logger.error).toHaveBeenCalledWith(`[hive][reporting] Failed to report schema: Service name is not defined`);
});

test('should display SchemaPublishMissingUrlError', async () => {
  const logger = {
    error: jest.fn(),
    info: jest.fn(),
  };

  const token = 'Token';
  const http = nock('http://localhost')
    .post('/200')
    .matchHeader('Authorization', `Bearer ${token}`)
    .matchHeader('Content-Type', headers['Content-Type'])
    .matchHeader('graphql-client-name', headers['graphql-client-name'])
    .matchHeader('graphql-client-version', headers['graphql-client-version'])
    .once()
    .reply((_, _body) => {
      return [
        200,
        {
          data: {
            schemaPublish: {
              __typename: 'SchemaPublishMissingUrlError',
              missingUrlError: 'Service url is required',
            },
          },
        },
      ];
    });

  const hive = createHive({
    enabled: true,
    debug: true,
    agent: {
      timeout: 500,
      maxRetries: 1,
      logger,
    },
    token: token,
    reporting: {
      author: 'Test',
      commit: 'Commit',
      endpoint: 'http://localhost/200',
    },
  });

  hive.reportSchema({
    schema: buildSchema(/* GraphQL */ `
      type Query {
        foo: String
      }
    `),
  });

  await waitFor(50);
  await hive.dispose();
  http.done();

  expect(logger.info).toHaveBeenCalledWith('[hive][reporting] Sending (queue 1) (attempt 1)');
  expect(logger.error).toHaveBeenCalledWith(`[hive][reporting] Failed to report schema: Service url is not defined`);
});
