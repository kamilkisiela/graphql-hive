import { buildSchema, parse } from 'graphql';
import nock from 'nock';
import { Logger, MemoryLogWriter } from '@graphql-hive/logger';
import { createHive } from '../src/client/client';
import { atLeastOnceSampler } from '../src/client/samplers';
import type { Report } from '../src/client/usage';
import { version } from '../src/version';
import {
  createHiveTestingLogger,
  fastFetchError,
  normalizeLogMessage,
  waitFor,
  waitUntil,
} from './test-utils';

const headers = {
  'Content-Type': 'application/json',
  'graphql-client-name': 'Hive Client',
  'graphql-client-version': version,
};

const schema = buildSchema(/* GraphQL */ `
  type Query {
    project(selector: ProjectSelectorInput!): Project
    projectsByType(type: ProjectType!): [Project!]!
    projects(filter: FilterInput): [Project!]!
  }

  type Mutation {
    deleteProject(selector: ProjectSelectorInput!): DeleteProjectPayload!
  }

  input ProjectSelectorInput {
    organization: ID!
    project: ID!
  }

  input FilterInput {
    type: ProjectType
    pagination: PaginationInput
  }

  input PaginationInput {
    limit: Int
    offset: Int
  }

  type ProjectSelector {
    organization: ID!
    project: ID!
  }

  type DeleteProjectPayload {
    selector: ProjectSelector!
    deletedProject: Project!
  }

  type Project {
    id: ID!
    cleanId: ID!
    name: String!
    type: ProjectType!
    buildUrl: String
    validationUrl: String
  }

  enum ProjectType {
    FEDERATION
    STITCHING
    SINGLE
    CUSTOM
  }
`);

const op = parse(/* GraphQL */ `
  mutation deleteProject($selector: ProjectSelectorInput!) {
    deleteProject(selector: $selector) {
      selector {
        organization
        project
      }
      deletedProject {
        ...ProjectFields
      }
    }
  }

  fragment ProjectFields on Project {
    id
    cleanId
    name
    type
  }
`);

const op2 = parse(/* GraphQL */ `
  query getProject($selector: ProjectSelectorInput!) {
    project(selector: $selector) {
      ...ProjectFields
    }
  }

  fragment ProjectFields on Project {
    id
    cleanId
    name
    type
  }
`);

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  nock.cleanAll();
});

test('should send data to Hive', async () => {
  const logger = createHiveTestingLogger();

  const token = 'Token';

  let report: Report = {
    size: 0,
    map: {},
    operations: [],
  };
  const http = nock('http://localhost')
    .post('/200')
    .matchHeader('Authorization', `Bearer ${token}`)
    .matchHeader('Content-Type', headers['Content-Type'])
    .matchHeader('graphql-client-name', headers['graphql-client-name'])
    .matchHeader('graphql-client-version', headers['graphql-client-version'])
    .once()
    .reply((_, _body) => {
      report = _body as any;
      return [200];
    });

  const hive = createHive({
    enabled: true,
    debug: true,
    agent: {
      timeout: 500,
      maxRetries: 0,
      sendInterval: 10,
      logger,
    },
    token,
    selfHosting: {
      graphqlEndpoint: 'http://localhost/graphql',
      applicationUrl: 'http://localhost/',
      usageEndpoint: 'http://localhost/200',
    },
    usage: true,
  });

  const collect = hive.collectUsage();

  await waitFor(20);
  await collect.finish(
    {
      schema,
      document: op,
      operationName: 'deleteProject',
    },
    {},
  );
  await hive.dispose();
  await waitFor(40);
  http.done();

  expect(logger.getLogs()).toMatchInlineSnapshot(`
    [DBG] Disposing
    [DBG] Sending report (queue 1)
    [DBG] POST http://localhost/200 (x-request-id=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
    [DBG] POST http://localhost/200 (x-request-id=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx) succeeded with status 200 (666ms).
    [DBG] Report sent!
  `);

  // Map
  expect(report.size).toEqual(1);
  expect(Object.keys(report.map)).toHaveLength(1);

  const key = Object.keys(report.map)[0];
  const record = report.map[key];

  // operation
  expect(record.operation).toMatch('mutation deleteProject');
  expect(record.operationName).toMatch('deleteProject');
  // fields
  expect(record.fields).toMatchInlineSnapshot(`
    [
      Mutation.deleteProject,
      Mutation.deleteProject.selector,
      DeleteProjectPayload.selector,
      ProjectSelector.organization,
      ProjectSelector.project,
      DeleteProjectPayload.deletedProject,
      Project.id,
      Project.cleanId,
      Project.name,
      Project.type,
      ProjectType.FEDERATION,
      ProjectType.STITCHING,
      ProjectType.SINGLE,
      ProjectType.CUSTOM,
      ProjectSelectorInput.organization,
      ID,
      ProjectSelectorInput.project,
    ]
  `);

  // Operations
  const operations = report.operations;
  expect(operations).toHaveLength(1); // one operation
  if (!operations?.length) {
    throw new Error('Expected operations to be an array');
  }

  const operation = operations[0];

  expect(operation.operationMapKey).toEqual(key);
  expect(operation.timestamp).toEqual(expect.any(Number));
  // execution
  expect(operation.execution.duration).toBeGreaterThanOrEqual(18 * 1_000_000); // >=18ms in microseconds
  expect(operation.execution.duration).toBeLessThan(25 * 1_000_000); // <25ms
  expect(operation.execution.errorsTotal).toBe(0);
  expect(operation.execution.ok).toBe(true);
});

test('reports nested abstract type usage including lists', async () => {
  const nestedSchema = buildSchema(/* GraphQL */ `
    interface Node {
      id: ID!
      child: Node
      children: [Node!]!
    }

    type Folder implements Node {
      id: ID!
      child: Node
      children: [Node!]!
    }

    type File implements Node {
      id: ID!
      child: Node
      children: [Node!]!
    }

    type Query {
      node: Node
    }
  `);
  const document = parse(/* GraphQL */ `
    query NestedNode {
      node {
        id
        child {
          id
        }
        children {
          id
        }
      }
    }
  `);
  const reportReceived = Promise.withResolvers<Report>();
  const hive = createHive({
    enabled: true,
    token: 'Token',
    reporting: false,
    usage: {
      endpoint: 'http://localhost/usage',
      fieldLevelMetricsEnabled: true,
    },
    agent: {
      maxSize: 1,
      maxRetries: 0,
      async fetch(_url, init) {
        reportReceived.resolve(JSON.parse(init?.body as string));
        return new Response(null, { status: 200 });
      },
    },
  });

  await hive.collectUsage().finish(
    {
      schema: nestedSchema,
      document,
      operationName: 'NestedNode',
    },
    {
      data: {
        node: {
          __typename: 'Folder',
          id: 'folder-1',
          child: {
            __typename: 'File',
            id: 'file-1',
          },
          children: [
            {
              __typename: 'File',
              id: 'file-2',
            },
            {
              __typename: 'File',
              id: 'file-3',
            },
            {
              __typename: 'Folder',
              id: 'folder-2',
            },
          ],
        },
      },
    },
  );

  const report = await reportReceived.promise;
  await hive.dispose();

  expect(report.operations).toHaveLength(1);
  expect(report.operations?.[0].execution.fetches).toEqual([
    expect.objectContaining({
      fields: {
        Query: 1,
        'Query.node': 1,
        Node: 5,
        Folder: 2,
        'Folder.id': 2,
        'Node.id': 5,
        ID: 5,
        'Folder.child': 1,
        'Node.child': 1,
        'Folder.children': 1,
        'Node.children': 1,
        File: 3,
        'File.id': 3,
      },
    }),
  ]);
});

test('should send data to Hive (deprecated endpoint)', async () => {
  const logger = createHiveTestingLogger();
  const token = 'Token';

  let report: Report = {
    size: 0,
    map: {},
    operations: [],
  };
  const http = nock('http://localhost')
    .post('/200')
    .matchHeader('Authorization', `Bearer ${token}`)
    .matchHeader('Content-Type', headers['Content-Type'])
    .matchHeader('graphql-client-name', headers['graphql-client-name'])
    .matchHeader('graphql-client-version', headers['graphql-client-version'])
    .once()
    .reply((_, _body) => {
      report = _body as any;
      return [200];
    });

  const hive = createHive({
    enabled: true,
    debug: true,
    agent: {
      timeout: 500,
      maxRetries: 0,
      sendInterval: 10,
      logger,
    },
    token,
    usage: {
      endpoint: 'http://localhost/200',
    },
  });

  const collect = hive.collectUsage();

  await waitFor(20);
  await collect.finish(
    {
      schema,
      document: op,
      operationName: 'deleteProject',
    },
    {},
  );
  await hive.dispose();
  await waitFor(50);
  http.done();

  expect(logger.getLogs()).toMatchInlineSnapshot(`
    [DBG] Disposing
    [DBG] Sending report (queue 1)
    [DBG] POST http://localhost/200 (x-request-id=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
    [DBG] POST http://localhost/200 (x-request-id=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx) succeeded with status 200 (666ms).
    [DBG] Report sent!
  `);

  // Map
  expect(report.size).toEqual(1);
  expect(Object.keys(report.map)).toHaveLength(1);

  const key = Object.keys(report.map)[0];
  const record = report.map[key];

  // operation
  expect(record.operation).toMatch('mutation deleteProject');
  expect(record.operationName).toMatch('deleteProject');
  // fields
  expect(record.fields).toMatchInlineSnapshot(`
    [
      Mutation.deleteProject,
      Mutation.deleteProject.selector,
      DeleteProjectPayload.selector,
      ProjectSelector.organization,
      ProjectSelector.project,
      DeleteProjectPayload.deletedProject,
      Project.id,
      Project.cleanId,
      Project.name,
      Project.type,
      ProjectType.FEDERATION,
      ProjectType.STITCHING,
      ProjectType.SINGLE,
      ProjectType.CUSTOM,
      ProjectSelectorInput.organization,
      ID,
      ProjectSelectorInput.project,
    ]
  `);

  // Operations
  const operations = report.operations;
  expect(operations).toHaveLength(1); // one operation
  if (!operations?.length) {
    throw new Error('Expected operations to be an array');
  }

  const operation = operations[0];

  expect(operation.operationMapKey).toEqual(key);
  expect(operation.timestamp).toEqual(expect.any(Number));
  // execution
  expect(operation.execution.duration).toBeGreaterThanOrEqual(18 * 1_000_000); // >=18ms in microseconds
  expect(operation.execution.duration).toBeLessThan(25 * 1_000_000); // <25ms
  expect(operation.execution.errorsTotal).toBe(0);
  expect(operation.execution.ok).toBe(true);
});

test('should not leak the exception', { retry: 3 }, async () => {
  const logger = createHiveTestingLogger();

  const hive = createHive({
    enabled: true,
    debug: true,
    agent: {
      fetch: fastFetchError,
      timeout: 500,
      maxRetries: 1,
      sendInterval: 10,
      minTimeout: 10,
      logger,
    },
    token: 'Token',
    usage: {
      endpoint: 'http://404.localhost.noop',
    },
  });

  await hive.collectUsage().finish(
    {
      schema,
      document: op,
      operationName: 'deleteProject',
    },
    {},
  );

  await waitFor(50);
  await hive.dispose();

  expect(logger.getLogs()).toMatchInlineSnapshot(`
    [DBG] Sending report (queue 1)
    [DBG] POST http://404.localhost.noop (x-request-id=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx) Attempt (1/2)
    [DBG] Error: getaddrinfo ENOTFOUND 404.localhost.noop
    [DBG] POST http://404.localhost.noop (x-request-id=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx) failed (666ms). getaddrinfo ENOTFOUND 404.localhost.noop
    [DBG] Disposing
  `);
});

test('sendImmediately should not stop the schedule', async () => {
  const logger = createHiveTestingLogger();

  const token = 'Token';

  const http = nock('http://localhost')
    .post('/200')
    .matchHeader('authorization', `Bearer ${token}`)
    .matchHeader('Content-Type', headers['Content-Type'])
    .matchHeader('graphql-client-name', headers['graphql-client-name'])
    .matchHeader('graphql-client-version', headers['graphql-client-version'])
    .times(3)
    .reply((_, _body) => {
      return [200];
    });

  const hive = createHive({
    enabled: true,
    debug: true,
    printTokenInfo: false,
    agent: {
      timeout: 500,
      maxRetries: 0,
      maxSize: 2,
      minTimeout: 10,
      logger,
      sendInterval: 50,
    },
    token,
    usage: {
      endpoint: 'http://localhost/200',
    },
  });

  const args = {
    schema,
    document: op,
    operationName: 'deleteProject',
  };

  const collect = hive.collectUsage();

  await collect.finish(
    {
      schema,
      document: op,
      operationName: 'deleteProject',
    },
    {},
  );
  await waitFor(120);
  // Because maxSize is 2 and sendInterval is 50ms (+120ms buffer)
  // the scheduled send task should be done by now

  // since we sent only 1 element, the buffer was not full,
  // so we should not see "Sending immediately"

  expect(logger.getLogs()).not.toMatch('Sending immediately');
  logger.clear();

  // Now we will hit the maxSize
  // We run collect two times
  await Promise.all([collect.finish(args, {}), collect.finish(args, {})]);
  await waitUntil(() => logger.getLogs().includes('Sending immediately'));
  expect(logger.getLogs()).toMatch('Sending report (queue 2)');
  logger.clear();
  // Let's check if the scheduled send task is still running
  await collect.finish(args, {});
  await waitFor(60);
  expect(logger.getLogs()).toMatch('Sending report (queue 1)');

  await hive.dispose();
  http.done();
});

test('should send data to Hive at least once when using atLeastOnceSampler', async () => {
  const logger = createHiveTestingLogger();

  const token = 'Token';

  let report: Report = {
    size: 0,
    map: {},
    operations: [],
  };
  const http = nock('http://localhost')
    .post('/200')
    .matchHeader('Authorization', `Bearer ${token}`)
    .matchHeader('Content-Type', headers['Content-Type'])
    .matchHeader('graphql-client-name', headers['graphql-client-name'])
    .matchHeader('graphql-client-version', headers['graphql-client-version'])
    .once()
    .reply((_, _body) => {
      report = _body as any;
      return [200];
    });

  const hive = createHive({
    enabled: true,
    debug: true,
    printTokenInfo: false,
    agent: {
      timeout: 500,
      sendInterval: 10,
      maxRetries: 0,
      logger,
    },
    token,
    selfHosting: {
      graphqlEndpoint: 'http://localhost/graphql',
      applicationUrl: 'http://localhost/',
      usageEndpoint: 'http://localhost/200',
    },
    usage: {
      sampler: atLeastOnceSampler({
        keyFn(ctx) {
          return ctx.operationName;
        },
        sampler() {
          // only
          return 0;
        },
      }),
    },
  });

  const collect = hive.collectUsage();

  await Promise.all([
    collect.finish(
      {
        schema,
        document: op,
        operationName: 'deleteProject',
      },
      {},
    ),
    // different query
    collect.finish(
      {
        schema,
        document: op2,
        operationName: 'getProject',
      },
      {},
    ),
    // duplicated call
    collect.finish(
      {
        schema,
        document: op,
        operationName: 'deleteProject',
      },
      {},
    ),
  ]);
  await hive.dispose();
  await waitUntil(() => logger.getLogs().includes('Report sent!'));
  http.done();

  expect(logger.getLogs()).toMatch(/\[DBG\] Disposing/);
  expect(logger.getLogs()).toMatch(/\[DBG\] Sending report \(queue 2\)/);
  expect(logger.getLogs()).toMatch(/\[DBG\] POST http:\/\/localhost\/200/);
  expect(logger.getLogs()).toMatch(/succeeded with status 200/);
  expect(logger.getLogs()).toMatch(/\[DBG\] Report sent!/);

  // Map
  expect(report.size).toEqual(2);
  expect(Object.keys(report.map)).toHaveLength(2);

  const foundRecords: string[] = [];
  for (const key in report.map) {
    const record = report.map[key];

    foundRecords.push(record.operationName ?? 'anonymous');
  }

  expect(foundRecords).toContainEqual('deleteProject');
  expect(foundRecords).toContainEqual('getProject');

  const operations = report.operations;
  expect(operations).toHaveLength(2); // two operations
});

test('should not send excluded operation name data to Hive', async () => {
  const logger = createHiveTestingLogger();

  const token = 'Token';

  let report: Report = {
    size: 0,
    map: {},
    operations: [],
  };
  const http = nock('http://localhost')
    .post('/200')
    .once()
    .reply((_, _body) => {
      report = _body as any;
      return [200];
    });

  const hive = createHive({
    enabled: true,
    debug: true,
    agent: {
      timeout: 500,
      maxRetries: 0,
      sendInterval: 10,
      logger,
    },
    token,
    selfHosting: {
      graphqlEndpoint: 'http://localhost/graphql',
      applicationUrl: 'http://localhost/',
      usageEndpoint: 'http://localhost/200',
    },
    usage: {
      exclude: ['deleteProjectShouldntBeIncluded', new RegExp('ExcludeThis$')],
    },
  });

  const collect = hive.collectUsage();
  await waitFor(20);
  await Promise.all([
    (collect.finish(
      {
        schema,
        document: op,
        operationName: 'deleteProjectExcludeThis',
      },
      {},
    ),
    collect.finish(
      {
        schema,
        document: op,
        operationName: 'deleteProjectShouldntBeIncluded',
      },
      {},
    ),
    collect.finish(
      {
        schema,
        document: op,
        operationName: 'deleteProject',
      },
      {},
    ),
    collect.finish(
      {
        schema,
        document: op2,
        operationName: 'getProject',
      },
      {},
    )),
  ]);
  await hive.dispose();
  await waitFor(50);
  http.done();

  expect(logger.getLogs()).toMatchInlineSnapshot(`
    [DBG] Disposing
    [DBG] Sending report (queue 2)
    [DBG] POST http://localhost/200 (x-request-id=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
    [DBG] POST http://localhost/200 (x-request-id=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx) succeeded with status 200 (666ms).
    [DBG] Report sent!
  `);

  // Map
  expect(report.size).toEqual(2);
  expect(Object.keys(report.map)).toHaveLength(2);

  for (const hash of Object.keys(report.map)) {
    const op = report.map[hash];
    if (op.operation.includes('mutation deleteProject')) {
      expect(op.operationName).toMatch('deleteProject');
      // fields
      expect(op.fields).toMatchInlineSnapshot(`
        [
          Mutation.deleteProject,
          Mutation.deleteProject.selector,
          DeleteProjectPayload.selector,
          ProjectSelector.organization,
          ProjectSelector.project,
          DeleteProjectPayload.deletedProject,
          Project.id,
          Project.cleanId,
          Project.name,
          Project.type,
          ProjectType.FEDERATION,
          ProjectType.STITCHING,
          ProjectType.SINGLE,
          ProjectType.CUSTOM,
          ProjectSelectorInput.organization,
          ID,
          ProjectSelectorInput.project,
        ]
      `);
    } else if (op.operation.includes('query getProject')) {
      expect(op.operationName).toMatch('getProject');
      expect(op.fields).toMatchInlineSnapshot(`
        [
          Query.project,
          Query.project.selector,
          Project.id,
          Project.cleanId,
          Project.name,
          Project.type,
          ProjectType.FEDERATION,
          ProjectType.STITCHING,
          ProjectType.SINGLE,
          ProjectType.CUSTOM,
          ProjectSelectorInput.organization,
          ID,
          ProjectSelectorInput.project,
        ]
      `);
    } else {
      throw new Error('Expected operation not found');
    }
  }

  // Operations
  const operations = report.operations;
  expect(operations).toHaveLength(2); // two operations
  if (!operations?.length) {
    throw new Error('Expected operations to be an array');
  }

  const operation = operations[0];
  expect(Object.keys(report.map)).toContain(operation.operationMapKey);
  expect(operation.timestamp).toEqual(expect.any(Number));
  // execution
  expect(operation.execution.duration).toBeGreaterThanOrEqual(18 * 1_000_000); // >=18ms in microseconds
  expect(operation.execution.duration).toBeLessThan(40 * 1_000_000); // <40ms. This is based on the waitFor(20). But timeouts are not exact.
  expect(operation.execution.errorsTotal).toBe(0);
  expect(operation.execution.ok).toBe(true);
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
      fetch: fetchSpy,
    },
    token,
    usage: {
      endpoint: 'http://localhost/200',
    },
    reporting: false,
  });

  const collect = hive.collectUsage();

  await collect.finish(
    {
      schema,
      document: op,
      operationName: 'asd',
    },
    {},
  );

  await waitFor(50);
  await hive.dispose();

  expect(logger.getLogs()).toMatchInlineSnapshot(`
    [DBG] Sending report (queue 1)
    [DBG] POST http://localhost/200 (x-request-id=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx) Attempt (1/2)
    [DBG] POST http://localhost/200 (x-request-id=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx) failed with status 500 (666ms): No no no
    [DBG] Disposing
  `);
});

test('constructs URL with usage.target (hvo1/)', async ({ expect }) => {
  const logger = createHiveTestingLogger();
  const token = 'hvo1/brrrrt';
  const dUrl = Promise.withResolvers<string>();

  const hive = createHive({
    enabled: true,
    debug: true,
    agent: {
      timeout: 500,
      maxRetries: 0,
      sendInterval: 1,
      maxSize: 1,
      async fetch(url) {
        dUrl.resolve(url.toString());
        return new Response('', {
          status: 200,
        });
      },
      logger,
    },
    token,
    selfHosting: {
      graphqlEndpoint: 'http://localhost:2/graphql',
      applicationUrl: 'http://localhost:1',
      usageEndpoint: 'http://localhost',
    },
    usage: {
      target: 'the-guild/graphql-hive/staging',
    },
  });

  await hive.collectUsage().finish(
    {
      schema,
      document: op,
      operationName: 'asd',
    },
    {},
  );

  const url = await dUrl.promise;
  expect(url).toEqual('http://localhost/the-guild/graphql-hive/staging');
  await hive.dispose();
});

test('constructs URL with usage.target (hvp1/)', async ({ expect }) => {
  const logger = createHiveTestingLogger();
  const token = 'hvp1/brrrrt';
  const dUrl = Promise.withResolvers<string>();

  const hive = createHive({
    enabled: true,
    debug: true,
    agent: {
      timeout: 500,
      maxRetries: 0,
      sendInterval: 1,
      maxSize: 1,
      async fetch(url) {
        dUrl.resolve(url.toString());
        return new Response('', {
          status: 200,
        });
      },
      logger,
    },
    token,
    selfHosting: {
      graphqlEndpoint: 'http://localhost:2/graphql',
      applicationUrl: 'http://localhost:1',
      usageEndpoint: 'http://localhost',
    },
    usage: {
      target: 'the-guild/graphql-hive/staging',
    },
  });

  await hive.collectUsage().finish(
    {
      schema,
      document: op,
      operationName: 'asd',
    },
    {},
  );

  const url = await dUrl.promise;
  expect(url).toEqual('http://localhost/the-guild/graphql-hive/staging');
  await hive.dispose();
});

test('constructs URL with usage.target (hvu1/)', async ({ expect }) => {
  const logger = createHiveTestingLogger();
  const token = 'hvu1/brrrrt';
  const dUrl = Promise.withResolvers<string>();

  const hive = createHive({
    enabled: true,
    debug: true,
    agent: {
      timeout: 500,
      maxRetries: 0,
      sendInterval: 1,
      maxSize: 1,
      async fetch(url) {
        dUrl.resolve(url.toString());
        return new Response('', {
          status: 200,
        });
      },
      logger,
    },
    token,
    selfHosting: {
      graphqlEndpoint: 'http://localhost:2/graphql',
      applicationUrl: 'http://localhost:1',
      usageEndpoint: 'http://localhost',
    },
    usage: {
      target: 'the-guild/graphql-hive/staging',
    },
  });

  await hive.collectUsage().finish(
    {
      schema,
      document: op,
      operationName: 'asd',
    },
    {},
  );

  const url = await dUrl.promise;
  expect(url).toEqual('http://localhost/the-guild/graphql-hive/staging');
  await hive.dispose();
});

test('no debug property -> logger.debug is invoked', async ({ expect }) => {
  const logger = createHiveTestingLogger();
  const token = 'hvu1/brrrrt';

  const hive = createHive({
    enabled: true,
    agent: {
      timeout: 500,
      maxRetries: 0,
      sendInterval: 1,
      maxSize: 1,
      async fetch() {
        return new Response('', {
          status: 200,
        });
      },
      logger,
    },
    token,
    selfHosting: {
      graphqlEndpoint: 'http://localhost:2/graphql',
      applicationUrl: 'http://localhost:1',
      usageEndpoint: 'http://localhost',
    },
    usage: {
      target: 'the-guild/graphql-hive/staging',
    },
  });

  await hive.collectUsage().finish(
    {
      schema,
      document: op,
      operationName: 'asd',
    },
    {},
  );

  await hive.dispose();
  expect(logger.getLogs()).toMatchInlineSnapshot(`
    [DBG] Disposing
    [DBG] Sending immediately
    [DBG] Sending report (queue 1)
    [DBG] POST http://localhost/the-guild/graphql-hive/staging (x-request-id=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
    [DBG] POST http://localhost/the-guild/graphql-hive/staging (x-request-id=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx) succeeded with status 200 (666ms).
    [DBG] Report sent!
  `);
});

test('debug: false -> logger.debug is not invoked', async ({ expect }) => {
  const logger = createHiveTestingLogger();
  const token = 'hvu1/brrrrt';

  const hive = createHive({
    enabled: true,
    debug: false,
    agent: {
      timeout: 500,
      maxRetries: 0,
      sendInterval: 1,
      maxSize: 1,
      async fetch() {
        return new Response('', {
          status: 200,
        });
      },
      logger,
    },
    token,
    selfHosting: {
      graphqlEndpoint: 'http://localhost:2/graphql',
      applicationUrl: 'http://localhost:1',
      usageEndpoint: 'http://localhost',
    },
    usage: {
      target: 'the-guild/graphql-hive/staging',
    },
  });

  await hive.collectUsage().finish(
    {
      schema,
      document: op,
      operationName: 'asd',
    },
    {},
  );

  await hive.dispose();
  expect(logger.getLogs()).toMatchInlineSnapshot(`
    [DBG] Disposing
    [DBG] Sending immediately
    [DBG] Sending report (queue 1)
    [DBG] POST http://localhost/the-guild/graphql-hive/staging (x-request-id=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
    [DBG] POST http://localhost/the-guild/graphql-hive/staging (x-request-id=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx) succeeded with status 200 (666ms).
    [DBG] Report sent!
  `);
});

test('debug: true and missing logger.debug method -> logger.info is invoked (to cover legacy logger implementation)', async ({
  expect,
}) => {
  const logger = createHiveTestingLogger();
  // @ts-expect-error we remove this property to emulate logger without it
  logger.debug = undefined;
  const token = 'hvu1/brrrrt';

  const hive = createHive({
    enabled: true,
    debug: true,
    agent: {
      timeout: 500,
      maxRetries: 0,
      sendInterval: 1,
      maxSize: 1,
      async fetch() {
        return new Response('', {
          status: 200,
        });
      },
      logger,
    },
    token,
    selfHosting: {
      graphqlEndpoint: 'http://localhost:2/graphql',
      applicationUrl: 'http://localhost:1',
      usageEndpoint: 'http://localhost',
    },
    usage: {
      target: 'the-guild/graphql-hive/staging',
    },
  });

  await hive.collectUsage().finish(
    {
      schema,
      document: op,
      operationName: 'asd',
    },
    {},
  );

  await hive.dispose();
  expect(logger.getLogs()).toMatchInlineSnapshot(`
    [INF] Disposing
    [INF] Sending immediately
    [INF] Sending report (queue 1)
    [INF] POST http://localhost/the-guild/graphql-hive/staging (x-request-id=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
    [INF] POST http://localhost/the-guild/graphql-hive/staging (x-request-id=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx) succeeded with status 200 (666ms).
    [INF] Report sent!
  `);
});

test('new logger option', async () => {
  const logWriter = new MemoryLogWriter();
  const logger = new Logger({
    writers: [
      {
        write(level, attrs, msg) {
          if (msg) {
            msg = normalizeLogMessage(msg);
          }

          logWriter.write(level, attrs, msg);
        },
      },
    ],
    level: 'debug',
  });

  const token = 'hvu1/brrrrt';

  const hive = createHive({
    enabled: true,
    logger,
    agent: {
      timeout: 500,
      maxRetries: 0,
      sendInterval: 1,
      maxSize: 1,
      async fetch() {
        return new Response('', {
          status: 200,
        });
      },
    },
    token,
    selfHosting: {
      graphqlEndpoint: 'http://localhost:2/graphql',
      applicationUrl: 'http://localhost:1',
      usageEndpoint: 'http://localhost',
    },
    usage: {
      target: 'the-guild/graphql-hive/staging',
    },
  });

  await hive.collectUsage().finish(
    {
      schema,
      document: op,
      operationName: 'asd',
    },
    {},
  );

  await hive.dispose();
  expect(logWriter.logs).toMatchInlineSnapshot(`
    [
      {
        attrs: {
          module: hive-agent,
        },
        level: debug,
        msg: Disposing,
      },
      {
        attrs: {
          module: hive-agent,
        },
        level: debug,
        msg: Sending immediately,
      },
      {
        attrs: {
          module: hive-agent,
        },
        level: debug,
        msg: Sending report (queue 1),
      },
      {
        attrs: {
          module: hive-agent,
        },
        level: debug,
        msg: POST http://localhost/the-guild/graphql-hive/staging (x-request-id=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx),
      },
      {
        attrs: {
          module: hive-agent,
        },
        level: debug,
        msg: POST http://localhost/the-guild/graphql-hive/staging (x-request-id=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx) succeeded with status 200 (666ms).,
      },
      {
        attrs: {
          module: hive-agent,
        },
        level: debug,
        msg: Report sent!,
      },
    ]
  `);
});

describe('graph version', () => {
  const graphId = '3c4bb3b0-3f8b-4b4b-8d1a-6a0b1e1f1e01';
  const graphVersionId = '9a8f8f5c-2a3a-4d2e-9b6c-0c8b2b4c5d02';

  function createReportingHive() {
    const fetchSpy = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => {
      return new Response(null, { status: 200 });
    });

    const hive = createHive({
      enabled: true,
      debug: false,
      agent: {
        timeout: 500,
        maxRetries: 0,
        sendInterval: 10,
        logger: createHiveTestingLogger(),
        fetch: fetchSpy,
      },
      token: 'Token',
      selfHosting: {
        graphqlEndpoint: 'http://localhost/graphql',
        applicationUrl: 'http://localhost/',
        usageEndpoint: 'http://localhost/200',
      },
      usage: true,
    });

    return {
      hive,
      async getReport() {
        await hive.dispose();
        expect(fetchSpy).toHaveBeenCalledOnce();
        const [url, init] = fetchSpy.mock.calls[0];
        expect(String(url)).toBe('http://localhost/200');
        expect(init?.method).toBe('POST');
        return JSON.parse(init?.body as string) as Report;
      },
    };
  }

  const graph = { graphId, graphVersionId };

  test('collectUsage attaches the provided graph', async () => {
    const { hive, getReport } = createReportingHive();

    await hive
      .collectUsage({ graph })
      .finish({ schema, document: op, operationName: 'deleteProject' }, {});

    const report = await getReport();
    expect(report.operations?.[0].metadata?.graph).toEqual(graph);
  });

  test('collectRequest attaches the provided graph', async () => {
    const { hive, getReport } = createReportingHive();

    hive.collectRequest({
      args: { schema, document: op, operationName: 'deleteProject' },
      result: {},
      duration: 1,
      graph,
    });
    await waitFor(10);

    const report = await getReport();
    expect(report.operations?.[0].metadata?.graph).toEqual(graph);
  });

  test('collectSubscriptionUsage attaches the provided graph', async () => {
    const { hive, getReport } = createReportingHive();

    hive.collectSubscriptionUsage({
      args: { schema, document: op2, operationName: 'getProject' },
      graph,
    });
    await waitFor(10);

    const report = await getReport();
    expect(report.subscriptionOperations?.[0].metadata?.graph).toEqual(graph);
  });

  test('omits graph metadata when not provided', async () => {
    const { hive, getReport } = createReportingHive();

    await hive.collectUsage().finish({ schema, document: op, operationName: 'deleteProject' }, {});

    const report = await getReport();
    expect(report.operations?.[0].metadata?.graph).toBeUndefined();
  });

  test('omits graph metadata when an id is not a UUID', async () => {
    const { hive, getReport } = createReportingHive();

    await hive
      .collectUsage({ graph: { graphId: 'not-a-uuid', graphVersionId } })
      .finish({ schema, document: op, operationName: 'deleteProject' }, {});

    const report = await getReport();
    expect(report.operations?.[0].metadata?.graph).toBeUndefined();
  });
});
