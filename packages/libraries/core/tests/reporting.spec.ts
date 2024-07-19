import { buildSchema, parse } from 'graphql';
import nock from 'nock';
import { buildSubgraphSchema as buildSubgraphSchemaV1 } from '@apollo/federation';
import { buildSubgraphSchema as buildSubgraphSchemaV2 } from '@apollo/subgraph';
import { createHive } from '../src/client/client';
import { version } from '../src/version';
import { createHiveTestingLogger, waitFor } from './test-utils';

afterEach(() => {
  nock.cleanAll();
});

const headers = {
  'Content-Type': 'application/json',
  'graphql-client-name': 'Hive Client',
  'graphql-client-version': version,
};

test('should not leak the exception', async () => {
  const logger = createHiveTestingLogger();

  const hive = createHive({
    enabled: true,
    debug: true,
    agent: {
      timeout: 50,
      maxRetries: 1,
      sendInterval: 10,
      minTimeout: 10,
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

  await waitFor(50);
  await hive.dispose();

  expect(logger.getLogs()).toMatchInlineSnapshot(`
    [INF] [hive][reporting] Publish schema
    [INF] [hive][reporting] POST http://127.0.0.1:55404 Attempt (1/6)
    [ERR] [hive][reporting] Error: connect ECONNREFUSED 127.0.0.1:55404
    [ERR] [hive][reporting]     at TCPConnectWrap.afterConnect [as oncomplete] (node:net:1607:16)
    [ERR] [hive][reporting] POST http://127.0.0.1:55404 failed (666ms). connect ECONNREFUSED 127.0.0.1:55404
  `);
});

test('should send data to Hive', async () => {
  const logger = createHiveTestingLogger();

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
      minTimeout: 10,
      sendInterval: 10,
      maxRetries: 0,
      logger,
    },
    token,
    selfHosting: {
      graphqlEndpoint: 'http://localhost/200',
      applicationUrl: 'http://localhost',
    },
    reporting: {
      author,
      commit,
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

  await waitFor(50);
  await hive.dispose();
  http.done();

  expect(logger.getLogs()).toMatchInlineSnapshot(`
    [INF] [hive][reporting] Sending immediately
    [INF] [hive][reporting] Sending report (queue 1)
    [INF] POST http://localhost/200
    [INF] POST http://localhost/200 succeeded with status 200 (666ms).
    [INF] [hive][reporting] Report sent!
    [INF] [hive][reporting] Published schema
    [INF] [hive][reporting] Disposing
  `);
});

test('should send data to Hive (deprecated endpoint)', async () => {
  const logger = createHiveTestingLogger();

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
      minTimeout: 10,
      sendInterval: 10,
      maxRetries: 0,
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

  await waitFor(50);
  await hive.dispose();
  http.done();

  expect(logger.getLogs()).toMatchInlineSnapshot(`
    [INF] [hive][reporting] Sending immediately
    [INF] [hive][reporting] Sending report (queue 1)
    [INF] POST http://localhost/200
    [INF] POST http://localhost/200 succeeded with status 200 (666ms).
    [INF] [hive][reporting] Report sent!
    [INF] [hive][reporting] Published schema
    [INF] [hive][reporting] Disposing
  `);

  expect(body.variables.input.sdl).toBe(`type Query{foo:String}`);
  expect(body.variables.input.author).toBe(author);
  expect(body.variables.input.commit).toBe(commit);
  expect(body.variables.input.service).toBe(serviceName);
  expect(body.variables.input.url).toBe(serviceUrl);
  expect(body.variables.input.force).toBe(true);
});

test('should send data to app.graphql-hive.com/graphql by default', async () => {
  const logger = createHiveTestingLogger();

  const author = 'Test';
  const commit = 'Commit';
  const token = 'Token';

  let body: any = {};
  const http = nock('https://app.graphql-hive.com')
    .post('/graphql')
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
      minTimeout: 10,
      sendInterval: 10,
      maxRetries: 0,
      logger,
    },
    token,
    reporting: {
      author,
      commit,
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

  expect(logger.getLogs()).toMatchInlineSnapshot(`
    [INF] [hive][reporting] Sending immediately
    [INF] [hive][reporting] Sending report (queue 1)
    [INF] POST https://app.graphql-hive.com/graphql
    [INF] POST https://app.graphql-hive.com/graphql succeeded with status 200 (666ms).
    [INF] [hive][reporting] Report sent!
    [INF] [hive][reporting] Published schema
    [INF] [hive][reporting] Disposing
  `);

  expect(body.variables.input.sdl).toBe(`type Query{foo:String}`);
  expect(body.variables.input.author).toBe(author);
  expect(body.variables.input.commit).toBe(commit);
  expect(body.variables.input.force).toBe(true);
});

test('should send data to Hive immediately', async () => {
  const logger = createHiveTestingLogger();

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
      maxRetries: 0,
      logger,
      sendInterval: 100,
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

  expect(logger.getLogs()).toMatchInlineSnapshot(`[INF] [hive][reporting] Publish schema`);
  logger.clear();
  await waitFor(50);
  expect(logger.getLogs()).toMatchInlineSnapshot(`
    [INF] [hive][reporting] POST http://localhost/200 Attempt (1/6)
    [ERR] [hive][reporting] Error: Nock: No match for request {
    [ERR] [hive][reporting]   "method": "POST",
    [ERR] [hive][reporting]   "url": "http://localhost/200",
    [ERR] [hive][reporting]   "headers": {
    [ERR] [hive][reporting]     "graphql-client-name": "Hive Client",
    [ERR] [hive][reporting]     "graphql-client-version": "0.5.0",
    [ERR] [hive][reporting]     "content-type": "text/plain;charset=UTF-8",
    [ERR] [hive][reporting]     "content-length": "530"
    [ERR] [hive][reporting]   },
    [ERR] [hive][reporting]   "body": "{\\"query\\":\\"mutation schemaPublish($input:SchemaPublishInput!){schemaPublish(input:$input){__typename ...on SchemaPublishSuccess{initial valid successMessage:message}...on SchemaPublishError{valid errors{nodes{message}total}}...on SchemaPublishMissingServiceError{missingServiceError:message}...on SchemaPublishMissingUrlError{missingUrlError:message}}}\\",\\"operationName\\":\\"schemaPublish\\",\\"variables\\":{\\"input\\":{\\"sdl\\":\\"type Query{foo:String}\\",\\"author\\":\\"Test\\",\\"commit\\":\\"Commit\\",\\"service\\":\\"my-api\\",\\"url\\":\\"https://api.com\\",\\"force\\":true}}}"
    [ERR] [hive][reporting] }
    [ERR] [hive][reporting]     at InterceptedRequestRouter.startPlayback (/Users/laurinquast/Projects/graphql-hive-3/node_modules/.pnpm/nock@14.0.0-beta.7/node_modules/nock/lib/intercepted_request_router.js:346:21)
    [ERR] [hive][reporting]     at InterceptedRequestRouter.maybeStartPlayback (/Users/laurinquast/Projects/graphql-hive-3/node_modules/.pnpm/nock@14.0.0-beta.7/node_modules/nock/lib/intercepted_request_router.js:268:12)
    [ERR] [hive][reporting]     at InterceptedRequestRouter.handleEnd (/Users/laurinquast/Projects/graphql-hive-3/node_modules/.pnpm/nock@14.0.0-beta.7/node_modules/nock/lib/intercepted_request_router.js:216:10)
    [ERR] [hive][reporting]     at OverriddenClientRequest.req.end (/Users/laurinquast/Projects/graphql-hive-3/node_modules/.pnpm/nock@14.0.0-beta.7/node_modules/nock/lib/intercepted_request_router.js:100:33)
    [ERR] [hive][reporting]     at Readable.onend (node:internal/streams/readable:946:10)
    [ERR] [hive][reporting]     at Object.onceWrapper (node:events:634:28)
    [ERR] [hive][reporting]     at Readable.emit (node:events:520:28)
    [ERR] [hive][reporting]     at endReadableNT (node:internal/streams/readable:1696:12)
    [ERR] [hive][reporting]     at processTicksAndRejections (node:internal/process/task_queues:82:21)
    [ERR] [hive][reporting] POST http://localhost/200 failed (666ms). Nock: No match for request {
      "method": "POST",
      "url": "http://localhost/200",
      "headers": {
        "graphql-client-name": "Hive Client",
        "graphql-client-version": "0.5.0",
        "content-type": "text/plain;charset=UTF-8",
        "content-length": "530"
      },
      "body": "{\\"query\\":\\"mutation schemaPublish($input:SchemaPublishInput!){schemaPublish(input:$input){__typename ...on SchemaPublishSuccess{initial valid successMessage:message}...on SchemaPublishError{valid errors{nodes{message}total}}...on SchemaPublishMissingServiceError{missingServiceError:message}...on SchemaPublishMissingUrlError{missingUrlError:message}}}\\",\\"operationName\\":\\"schemaPublish\\",\\"variables\\":{\\"input\\":{\\"sdl\\":\\"type Query{foo:String}\\",\\"author\\":\\"Test\\",\\"commit\\":\\"Commit\\",\\"service\\":\\"my-api\\",\\"url\\":\\"https://api.com\\",\\"force\\":true}}}"
    }
  `);
  expect(body.variables.input.sdl).toBe(`type Query{foo:String}`);
  expect(body.variables.input.author).toBe(author);
  expect(body.variables.input.commit).toBe(commit);
  expect(body.variables.input.service).toBe(serviceName);
  expect(body.variables.input.url).toBe(serviceUrl);
  expect(body.variables.input.force).toBe(true);

  await waitFor(100);
  expect(logger.getLogs()).toMatchInlineSnapshot(`
    [INF] [hive][reporting] Sending report (queue 1)
    [INF] POST http://localhost/200
    [INF] POST http://localhost/200 succeeded with status 200 (666ms).
    [INF] [hive][reporting] Report sent!
    [INF] [hive][reporting] Successfully published schema
  `);

  await hive.dispose();
  http.done();
});

test('should send original schema of a federated (v1) service', async () => {
  const logger = createHiveTestingLogger();

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
      maxRetries: 0,
      minTimeout: 10,
      sendInterval: 10,
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

  const http = nock('http://localhost')
    .post('/200')
    .matchHeader('Authorization', `Bearer ${token}`)
    .matchHeader('Content-Type', headers['Content-Type'])
    .matchHeader('graphql-client-name', headers['graphql-client-name'])
    .matchHeader('graphql-client-version', headers['graphql-client-version'])
    .once()
    .reply((_, body: any) => {
      expect(body.variables.input.sdl).toBe(`type Query{bar:String}`);
      expect(body.variables.input.author).toBe(author);
      expect(body.variables.input.commit).toBe(commit);
      expect(body.variables.input.service).toBe(serviceName);
      expect(body.variables.input.url).toBe(serviceUrl);
      expect(body.variables.input.force).toBe(true);
      return [200];
    });

  hive.reportSchema({
    schema: buildSubgraphSchemaV1(
      parse(/* GraphQL */ `
        type Query {
          bar: String
        }
      `),
    ),
  });

  await hive.dispose();
  http.done();
});

test('should send original schema of a federated (v2) service', async () => {
  const logger = createHiveTestingLogger();

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
      sendInterval: 10,
      minTimeout: 10,
      maxRetries: 0,
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

  const http = nock('http://localhost')
    .post('/200')
    .matchHeader('Authorization', `Bearer ${token}`)
    .matchHeader('Content-Type', headers['Content-Type'])
    .matchHeader('graphql-client-name', headers['graphql-client-name'])
    .matchHeader('graphql-client-version', headers['graphql-client-version'])
    .once()
    .reply((_, body: any) => {
      expect(body.variables.input.sdl).toBe(`type Query{bar:String}`);
      expect(body.variables.input.author).toBe(author);
      expect(body.variables.input.commit).toBe(commit);
      expect(body.variables.input.service).toBe(serviceName);
      expect(body.variables.input.url).toBe(serviceUrl);
      expect(body.variables.input.force).toBe(true);
      return [200];
    });

  hive.reportSchema({
    schema: buildSubgraphSchemaV2(
      parse(/* GraphQL */ `
        type Query {
          bar: String
        }
      `),
    ),
  });

  await hive.dispose();
  http.done();
});

test('should display SchemaPublishMissingServiceError', async () => {
  const logger = createHiveTestingLogger();
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
    token,
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

  expect(logger.getLogs()).toMatchInlineSnapshot(`
    [INF] [hive][reporting] Sending immediately
    [INF] [hive][reporting] Sending report (queue 1)
    [INF] POST http://localhost/200 Attempt (1/2)
    [INF] POST http://localhost/200 succeeded with status 200 (666ms).
    [INF] [hive][reporting] Report sent!
    [ERR] [hive][reporting] Failed to report schema: Service name is not defined
    [INF] [hive][reporting] Disposing
  `);
});

test('should display SchemaPublishMissingUrlError', async () => {
  const logger = createHiveTestingLogger();

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
    token,
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

  expect(logger.getLogs()).toMatchInlineSnapshot(`
    [INF] [hive][reporting] Sending immediately
    [INF] [hive][reporting] Sending report (queue 1)
    [INF] POST http://localhost/200 Attempt (1/2)
    [INF] POST http://localhost/200 succeeded with status 200 (666ms).
    [INF] [hive][reporting] Report sent!
    [ERR] [hive][reporting] Failed to report schema: Service url is not defined
    [INF] [hive][reporting] Disposing
  `);

  expect(logger.getLogs()).toContain('[hive][reporting] Sending report (queue 1)');
  expect(logger.getLogs()).toContain('Service url is not defined');
});

test('retry on non-200', async () => {
  const logger = createHiveTestingLogger();

  const token = 'Token';

  const fetchSpy = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => {
    return new Response('No no no', { status: 500, statusText: 'Internal server error' });
  });

  const hive = createHive({
    enabled: true,
    debug: true,
    printTokenInfo: false,
    agent: {
      logger,
      timeout: 10,
      minTimeout: 10,
      sendInterval: 10,
      maxRetries: 1,
      __testing: {
        fetch: fetchSpy,
      },
    },
    token,
    reporting: {
      author: 'Test',
      commit: 'Commit',
      endpoint: 'http://localhost/registry',
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

  expect(logger.getLogs()).toMatchInlineSnapshot(`
    [INF] [hive][reporting] Publish schema
    [INF] [hive][reporting] POST http://localhost/registry Attempt (1/6)
    [ERR] [hive][reporting] Error: connect ECONNREFUSED ::1:80
    [ERR] [hive][reporting]     at createConnectionError (node:net:1648:14)
    [ERR] [hive][reporting]     at afterConnectMultiple (node:net:1678:16)
    [ERR] [hive][reporting] Error: connect ECONNREFUSED 127.0.0.1:80
    [ERR] [hive][reporting]     at createConnectionError (node:net:1648:14)
    [ERR] [hive][reporting]     at afterConnectMultiple (node:net:1678:16)
    [ERR] [hive][reporting] POST http://localhost/registry failed (666ms).
  `);
});
