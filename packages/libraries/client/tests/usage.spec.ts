import { buildSchema, parse } from 'graphql';
// eslint-disable-next-line import/no-extraneous-dependencies
import nock from 'nock';
import { createHive } from '../src/client';
import type { Report } from '../src/internal/usage';
import { atLeastOnceSampler } from '../src/samplers';
import { version } from '../src/version';
import { waitFor } from './test-utils';

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
  const logger = {
    error: vi.fn(),
    info: vi.fn(),
  };

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

  await waitFor(2000);
  collect(
    {
      schema,
      document: op,
      operationName: 'deleteProject',
    },
    {},
  );
  await hive.dispose();
  await waitFor(1000);
  http.done();

  expect(logger.error).not.toHaveBeenCalled();
  expect(logger.info).toHaveBeenCalledWith(`[hive][usage] Sending (queue 1) (attempt 1)`);
  expect(logger.info).toHaveBeenCalledWith(`[hive][usage] Sent!`);

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
  expect(operation.execution.duration).toBeGreaterThanOrEqual(1500 * 1_000_000); // >=1500ms in microseconds
  expect(operation.execution.duration).toBeLessThan(3000 * 1_000_000); // <3000ms
  expect(operation.execution.errorsTotal).toBe(0);
  expect(operation.execution.ok).toBe(true);
});

test('should send data to Hive (deprecated endpoint)', async () => {
  const logger = {
    error: vi.fn(),
    info: vi.fn(),
  };

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
      logger,
    },
    token,
    usage: {
      endpoint: 'http://localhost/200',
    },
  });

  const collect = hive.collectUsage();

  await waitFor(2000);
  collect(
    {
      schema,
      document: op,
      operationName: 'deleteProject',
    },
    {},
  );
  await hive.dispose();
  await waitFor(1000);
  http.done();

  expect(logger.error).not.toHaveBeenCalled();
  expect(logger.info).toHaveBeenCalledWith(`[hive][usage] Sending (queue 1) (attempt 1)`);
  expect(logger.info).toHaveBeenCalledWith(`[hive][usage] Sent!`);

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
  expect(operation.execution.duration).toBeGreaterThanOrEqual(1500 * 1_000_000); // >=1500ms in microseconds
  expect(operation.execution.duration).toBeLessThan(3000 * 1_000_000); // <3000ms
  expect(operation.execution.errorsTotal).toBe(0);
  expect(operation.execution.ok).toBe(true);
});

test('should not leak the exception', async () => {
  const logger = {
    error: vi.fn(),
    info: vi.fn(),
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
    usage: {
      endpoint: 'http://404.localhost',
    },
  });

  hive.collectUsage()(
    {
      schema,
      document: op,
      operationName: 'deleteProject',
    },
    {},
  );

  await waitFor(1000);
  await hive.dispose();

  expect(logger.info).toHaveBeenCalledWith(`[hive][usage] Sending (queue 1) (attempt 1)`);
  expect(logger.info).toHaveBeenCalledWith(
    expect.stringContaining(`[hive][usage] Attempt 1 failed:`),
  );
  expect(logger.info).toHaveBeenCalledWith(`[hive][usage] Sending (queue 1) (attempt 2)`);
  expect(logger.error).toHaveBeenCalledTimes(1);
  expect(logger.error).toHaveBeenCalledWith(
    expect.stringContaining(`[hive][usage] Failed to send data`),
  );
});

test('sendImmediately should not stop the schedule', async () => {
  const logger = {
    error: vi.fn(),
    info: vi.fn(),
  };

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
    agent: {
      timeout: 500,
      maxRetries: 0,
      maxSize: 2,
      logger,
      sendInterval: 100,
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

  expect(logger.info).toHaveBeenCalledTimes(0);

  collect(
    {
      schema,
      document: op,
      operationName: 'deleteProject',
    },
    {},
  );
  await waitFor(200);
  // Because maxSize is 2 and sendInterval is 100ms
  // the scheduled send task should be done by now
  expect(logger.error).not.toHaveBeenCalled();
  expect(logger.info).toHaveBeenCalledWith(`[hive][usage] Sending (queue 1) (attempt 1)`);
  expect(logger.info).toHaveBeenCalledWith(`[hive][usage] Sent!`);
  expect(logger.info).not.toHaveBeenCalledWith(`[hive][usage] Sending immediately`);
  expect(logger.info).toHaveBeenCalledTimes(2);

  // Now we will check the maxSize
  // We run collect three times
  collect(args, {});
  collect(args, {});
  expect(logger.error).not.toHaveBeenCalled();
  expect(logger.info).toHaveBeenCalledWith(`[hive][usage] Sending (queue 1) (attempt 1)`);
  expect(logger.info).toHaveBeenCalledWith(`[hive][usage] Sending immediately`);
  await waitFor(1); // we run setImmediate under the hood
  // It should be sent already
  expect(logger.info).toHaveBeenCalledWith(`[hive][usage] Sent!`);
  expect(logger.info).toHaveBeenCalledTimes(4);

  await waitFor(50);
  expect(logger.info).toHaveBeenCalledTimes(5);

  // Let's check if the scheduled send task is still running
  collect(args, {});
  await waitFor(200);
  expect(logger.error).not.toHaveBeenCalled();
  expect(logger.info).toHaveBeenCalledWith(`[hive][usage] Sending (queue 1) (attempt 1)`);
  expect(logger.info).toHaveBeenCalledWith(`[hive][usage] Sent!`);
  expect(logger.info).toHaveBeenCalledTimes(7);

  await hive.dispose();
  await waitFor(1000);
  http.done();
});

test('should send data to Hive at least once when using atLeastOnceSampler', async () => {
  const logger = {
    error: vi.fn(),
    info: vi.fn(),
  };

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

  await waitFor(2000);
  collect(
    {
      schema,
      document: op,
      operationName: 'deleteProject',
    },
    {},
  );
  // different query
  collect(
    {
      schema,
      document: op2,
      operationName: 'getProject',
    },
    {},
  );
  // duplicated call
  collect(
    {
      schema,
      document: op,
      operationName: 'deleteProject',
    },
    {},
  );
  await hive.dispose();
  await waitFor(1000);
  http.done();

  expect(logger.error).not.toHaveBeenCalled();
  expect(logger.info).toHaveBeenCalledWith(`[hive][usage] Sending (queue 2) (attempt 1)`);
  expect(logger.info).toHaveBeenCalledWith(`[hive][usage] Sent!`);

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
  const logger = {
    error: vi.fn(),
    info: vi.fn(),
  };

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

  await waitFor(2000);
  collect(
    {
      schema,
      document: op,
      operationName: 'deleteProjectExcludeThis',
    },
    {},
  );
  collect(
    {
      schema,
      document: op,
      operationName: 'deleteProjectShouldntBeIncluded',
    },
    {},
  );
  collect(
    {
      schema,
      document: op,
      operationName: 'deleteProject',
    },
    {},
  );
  collect(
    {
      schema,
      document: op2,
      operationName: 'getProject',
    },
    {},
  );
  await hive.dispose();
  await waitFor(1000);
  http.done();

  expect(logger.error).not.toHaveBeenCalled();
  expect(logger.info).toHaveBeenCalledWith(`[hive][usage] Sending (queue 2) (attempt 1)`);
  expect(logger.info).toHaveBeenCalledWith(`[hive][usage] Sent!`);

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
  expect(operation.execution.duration).toBeGreaterThanOrEqual(1500 * 1_000_000); // >=1500ms in microseconds
  expect(operation.execution.duration).toBeLessThan(3000 * 1_000_000); // <3000ms
  expect(operation.execution.errorsTotal).toBe(0);
  expect(operation.execution.ok).toBe(true);
});
