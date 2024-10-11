import { buildSchema, parse } from 'graphql';
import nock from 'nock';
import { createHive } from '../src/client/client';
import { atLeastOnceSampler } from '../src/client/samplers';
import type { Report } from '../src/client/usage';
import { version } from '../src/version';
import { createHiveTestingLogger, waitFor } from './test-utils';

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
  await collect(
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
    [INF] [hive][usage] Disposing
    [INF] [hive][usage] Sending report (queue 1)
    [INF] [hive][usage] POST http://localhost/200
    [INF] [hive][usage] POST http://localhost/200 succeeded with status 200 (666ms).
    [INF] [hive][usage] Report sent!
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
  await collect(
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
    [INF] [hive][usage] Disposing
    [INF] [hive][usage] Sending report (queue 1)
    [INF] [hive][usage] POST http://localhost/200
    [INF] [hive][usage] POST http://localhost/200 succeeded with status 200 (666ms).
    [INF] [hive][usage] Report sent!
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

test('should not leak the exception', async () => {
  const logger = createHiveTestingLogger();

  const hive = createHive({
    enabled: true,
    debug: true,
    agent: {
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

  await hive.collectUsage()(
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
    [INF] [hive][usage] Sending report (queue 1)
    [INF] [hive][usage] POST http://404.localhost.noop Attempt (1/2)
    [ERR] [hive][usage] Error: getaddrinfo ENOTFOUND 404.localhost.noop
    [ERR] [hive][usage]     at GetAddrInfoReqWrap.onlookupall [as oncomplete] (node:dns:666:666)
    [ERR] [hive][usage] POST http://404.localhost.noop failed (666ms). getaddrinfo ENOTFOUND 404.localhost.noop
    [INF] [hive][usage] Disposing
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

  await collect(
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

  expect(logger.getLogs()).toMatchInlineSnapshot(`
    [INF] [hive][usage] Sending report (queue 1)
    [INF] [hive][usage] POST http://localhost/200
    [INF] [hive][usage] POST http://localhost/200 succeeded with status 200 (666ms).
    [INF] [hive][usage] Report sent!
  `);
  logger.clear();

  // Now we will hit the maxSize
  // We run collect two times
  await Promise.all([collect(args, {}), collect(args, {})]);
  await waitFor(1);
  expect(logger.getLogs()).toMatchInlineSnapshot(`
    [INF] [hive][usage] Sending immediately
    [INF] [hive][usage] Sending report (queue 2)
    [INF] [hive][usage] POST http://localhost/200
  `);
  logger.clear();
  await waitFor(100);
  // Let's check if the scheduled send task is still running
  await collect(args, {});
  await waitFor(40);
  expect(logger.getLogs()).toMatchInlineSnapshot(`
    [INF] [hive][usage] POST http://localhost/200 succeeded with status 200 (666ms).
    [INF] [hive][usage] Report sent!
    [INF] [hive][usage] Sending report (queue 1)
    [INF] [hive][usage] POST http://localhost/200
    [INF] [hive][usage] POST http://localhost/200 succeeded with status 200 (666ms).
    [INF] [hive][usage] Report sent!
  `);

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
    collect(
      {
        schema,
        document: op,
        operationName: 'deleteProject',
      },
      {},
    ),
    // different query
    collect(
      {
        schema,
        document: op2,
        operationName: 'getProject',
      },
      {},
    ),
    // duplicated call
    collect(
      {
        schema,
        document: op,
        operationName: 'deleteProject',
      },
      {},
    ),
  ]);
  await hive.dispose();
  await waitFor(50);
  http.done();

  expect(logger.getLogs()).toMatchInlineSnapshot(`
    [INF] [hive][usage] Disposing
    [INF] [hive][usage] Sending report (queue 2)
    [INF] [hive][usage] POST http://localhost/200
    [INF] [hive][usage] POST http://localhost/200 succeeded with status 200 (666ms).
    [INF] [hive][usage] Report sent!
  `);

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
    (collect(
      {
        schema,
        document: op,
        operationName: 'deleteProjectExcludeThis',
      },
      {},
    ),
    collect(
      {
        schema,
        document: op,
        operationName: 'deleteProjectShouldntBeIncluded',
      },
      {},
    ),
    collect(
      {
        schema,
        document: op,
        operationName: 'deleteProject',
      },
      {},
    ),
    collect(
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
    [INF] [hive][usage] Disposing
    [INF] [hive][usage] Sending report (queue 2)
    [INF] [hive][usage] POST http://localhost/200
    [INF] [hive][usage] POST http://localhost/200 succeeded with status 200 (666ms).
    [INF] [hive][usage] Report sent!
  `);

  // Map
  expect(report.size).toEqual(2);
  expect(Object.keys(report.map)).toHaveLength(2);

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
  expect(operations).toHaveLength(2); // two operations
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
    usage: {
      endpoint: 'http://localhost/200',
    },
    reporting: false,
  });

  const collect = hive.collectUsage();

  await collect(
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
    [INF] [hive][usage] Sending report (queue 1)
    [INF] [hive][usage] POST http://localhost/200 Attempt (1/2)
    [ERR] [hive][usage] POST http://localhost/200 failed with status 500 (666ms): No no no
    [INF] [hive][usage] Disposing
  `);
});
