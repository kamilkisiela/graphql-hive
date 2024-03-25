import formatISO from 'date-fns/formatISO';
import subHours from 'date-fns/subHours';
import { buildASTSchema, parse, print } from 'graphql';
import { createLogger } from 'graphql-yoga';
import { execute } from 'testkit/graphql';
import { getServiceHost } from 'testkit/utils';
import { graphql } from '@app/gql';
import {
  OrganizationAccessScope,
  ProjectAccessScope,
  ProjectType,
  TargetAccessScope,
} from '@app/gql/graphql';
// eslint-disable-next-line hive/enforce-deps-in-dev
import { normalizeOperation } from '@graphql-hive/core';
import { createHive } from '../../../../packages/libraries/client/src';
import { clickHouseQuery } from '../../../testkit/clickhouse';
import { createTarget, updateTargetValidationSettings, waitFor } from '../../../testkit/flow';
import { initSeed } from '../../../testkit/seed';
import { CollectedOperation } from '../../../testkit/usage';

function ensureNumber(value: number | string): number {
  if (typeof value === 'number') {
    return value;
  }

  return parseFloat(value);
}

function prepareBatch(amount: number, operation: CollectedOperation) {
  return new Array(amount).fill(operation);
}

test.concurrent(
  'collect operation and publish schema using WRITE access but read operations and check schema using READ access',
  async () => {
    const { createOrg } = await initSeed().createOwner();
    const { createProject } = await createOrg();
    const { createToken } = await createProject(ProjectType.Single);
    const settingsToken = await createToken({
      targetScopes: [TargetAccessScope.Read, TargetAccessScope.Settings],
      projectScopes: [ProjectAccessScope.Read],
      organizationScopes: [OrganizationAccessScope.Read],
    });

    const writeToken = await createToken({
      targetScopes: [
        TargetAccessScope.Read,
        TargetAccessScope.RegistryRead,
        TargetAccessScope.RegistryWrite,
      ],
      projectScopes: [ProjectAccessScope.Read],
      organizationScopes: [OrganizationAccessScope.Read],
    });

    const readToken = await createToken({
      targetScopes: [TargetAccessScope.Read, TargetAccessScope.RegistryRead],
      projectScopes: [ProjectAccessScope.Read],
      organizationScopes: [OrganizationAccessScope.Read],
    });

    const schemaPublishResult = await writeToken
      .publishSchema({
        author: 'Kamil',
        commit: 'abc123',
        sdl: `type Query { ping: String me: String }`,
      })
      .then(r => r.expectNoGraphQLErrors());

    expect((schemaPublishResult.schemaPublish as any).valid).toEqual(true);

    const targetValidationResult = await settingsToken.toggleTargetValidation(true);
    expect(targetValidationResult.setTargetValidation.validationSettings.enabled).toEqual(true);
    expect(targetValidationResult.setTargetValidation.validationSettings.percentage).toEqual(0);
    expect(targetValidationResult.setTargetValidation.validationSettings.period).toEqual(30);

    // should not be breaking because the field is unused
    const unusedCheckResult = await readToken
      .checkSchema(`type Query { me: String }`)
      .then(r => r.expectNoGraphQLErrors());
    expect(unusedCheckResult.schemaCheck.__typename).toEqual('SchemaCheckSuccess');

    const collectResult = await writeToken.collectLegacyOperations([
      {
        operation: 'query ping { ping }',
        operationName: 'ping',
        fields: ['Query', 'Query.ping'],
        execution: {
          ok: true,
          duration: 200_000_000,
          errorsTotal: 0,
        },
      },
    ]);
    expect(collectResult.status).toEqual(200);
    await waitFor(5000);

    // should be breaking because the field is used now
    const usedCheckResult = await readToken
      .checkSchema(`type Query { me: String }`)
      .then(r => r.expectNoGraphQLErrors());

    if (usedCheckResult.schemaCheck.__typename !== 'SchemaCheckError') {
      throw new Error(`Expected SchemaCheckError, got ${usedCheckResult.schemaCheck.__typename}`);
    }

    expect(usedCheckResult.schemaCheck.valid).toEqual(false);

    const from = formatISO(subHours(Date.now(), 6));
    const to = formatISO(Date.now());
    const operationsStats = await readToken.readOperationsStats(from, to);
    expect(operationsStats.operations.nodes).toHaveLength(1);

    const op = operationsStats.operations.nodes[0];

    expect(op.count).toEqual(1);
    await expect(writeToken.readOperationBody(op.operationHash!)).resolves.toEqual(
      'query ping{ping}',
    );
    expect(op.operationHash).toBeDefined();
    expect(op.duration.p75).toEqual(200);
    expect(op.duration.p90).toEqual(200);
    expect(op.duration.p95).toEqual(200);
    expect(op.duration.p99).toEqual(200);
    expect(op.kind).toEqual('query');
    expect(op.name).toMatch('ping');
    expect(op.percentage).toBeGreaterThan(99);
  },
);

test.concurrent('normalize and collect operation without breaking its syntax', async () => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject } = await createOrg();
  const { createToken } = await createProject(ProjectType.Single);
  const writeToken = await createToken({
    targetScopes: [
      TargetAccessScope.Read,
      TargetAccessScope.RegistryRead,
      TargetAccessScope.RegistryWrite,
    ],
    projectScopes: [ProjectAccessScope.Read],
    organizationScopes: [OrganizationAccessScope.Read],
  });

  const raw_document = `
    query outfit {
      recommendations(
        input: {
          strategies: [{ name: "asd" }]
          articleId: "asd"
          customerId: "asd"
          phoenixEnabled: true
          sessionId: "asd"
        }
      ) {
        ... on RecommendationResponse {
          frequentlyBoughtTogether {
            recommendedProducts {
              id
            }
            strategyMessage
          }
          outfit {
            strategyMessage
          }
          outfit {
            recommendedProducts {
              articleId
              id
              imageUrl
              name
              productUrl
              rating
              tCode
            }
            strategyMessage
          }
          similar {
            recommendedProducts {
              articleId
              id
              imageUrl
              name
              productUrl
              rating
              tCode
            }
            strategyMessage
          }
          visualSearch {
            strategyMessage
          }
        }
      }
    }
  `;

  const normalized_document = normalizeOperation({
    document: parse(raw_document),
    operationName: 'outfit',
    hideLiterals: true,
    removeAliases: true,
  });

  const collectResult = await writeToken.collectLegacyOperations([
    {
      operation: normalizeOperation({
        document: parse(raw_document),
        operationName: 'outfit',
        hideLiterals: true,
        removeAliases: true,
      }),
      operationName: 'outfit',
      fields: ['Query', 'Query.ping'],
      execution: {
        ok: true,
        duration: 200_000_000,
        errorsTotal: 0,
      },
    },
  ]);
  expect(collectResult.status).toEqual(200);
  await waitFor(5000);

  const from = formatISO(subHours(Date.now(), 6));
  const to = formatISO(Date.now());
  const operationsStats = await writeToken.readOperationsStats(from, to);
  expect(operationsStats.operations.nodes).toHaveLength(1);

  const op = operationsStats.operations.nodes[0];
  expect(op.count).toEqual(1);

  const doc = await writeToken.readOperationBody(op.operationHash!);

  if (!doc) {
    throw new Error('Operation body is empty');
  }

  expect(() => {
    parse(doc);
  }).not.toThrow();
  expect(print(parse(doc))).toEqual(print(parse(normalized_document)));
  expect(op.operationHash).toBeDefined();
  expect(op.duration.p75).toEqual(200);
  expect(op.duration.p90).toEqual(200);
  expect(op.duration.p95).toEqual(200);
  expect(op.duration.p99).toEqual(200);
  expect(op.kind).toEqual('query');
  expect(op.name).toMatch('outfit');
  expect(op.percentage).toBeGreaterThan(99);
});

test.concurrent(
  'number of produced and collected operations should match (no errors)',
  async () => {
    const { createOrg } = await initSeed().createOwner();
    const { createProject } = await createOrg();
    const { createToken } = await createProject(ProjectType.Single);
    const writeToken = await createToken({
      targetScopes: [
        TargetAccessScope.Read,
        TargetAccessScope.RegistryRead,
        TargetAccessScope.RegistryWrite,
      ],
      projectScopes: [ProjectAccessScope.Read],
      organizationScopes: [OrganizationAccessScope.Read],
    });

    const batchSize = 1000;
    const totalAmount = 10_000;

    for await (const _ of new Array(totalAmount / batchSize)) {
      await writeToken.collectLegacyOperations(
        prepareBatch(batchSize, {
          operation: 'query ping { ping }',
          operationName: 'ping',
          fields: ['Query', 'Query.ping'],
          execution: {
            ok: true,
            duration: 200_000_000,
            errorsTotal: 0,
          },
        }),
      );
    }

    await waitFor(5000);

    const from = formatISO(subHours(Date.now(), 6));
    const to = formatISO(Date.now());
    const operationsStats = await writeToken.readOperationsStats(from, to);

    // We sent a single operation (multiple times)
    expect(operationsStats.operations.nodes).toHaveLength(1);

    const op = operationsStats.operations.nodes[0];
    expect(op.count).toEqual(totalAmount);
    await expect(writeToken.readOperationBody(op.operationHash!)).resolves.toEqual(
      'query ping{ping}',
    );
    expect(op.operationHash).toBeDefined();
    expect(op.duration.p75).toEqual(200);
    expect(op.duration.p90).toEqual(200);
    expect(op.duration.p95).toEqual(200);
    expect(op.duration.p99).toEqual(200);
    expect(op.kind).toEqual('query');
    expect(op.name).toMatch('ping');
    expect(op.percentage).toBeGreaterThan(99);
  },
);

test.concurrent('check usage from two selected targets', async () => {
  const { createOrg, ownerToken } = await initSeed().createOwner();
  const { organization, createProject } = await createOrg();
  const { project, target: staging, createToken } = await createProject(ProjectType.Single);

  const productionTargetResult = await createTarget(
    {
      name: 'target2',
      organization: organization.cleanId,
      project: project.cleanId,
    },
    ownerToken,
  ).then(r => r.expectNoGraphQLErrors());

  expect(productionTargetResult.createTarget.error).toBeNull();
  const productionTarget = productionTargetResult.createTarget.ok!.createdTarget;

  const stagingToken = await createToken({
    targetScopes: [
      TargetAccessScope.Read,
      TargetAccessScope.RegistryRead,
      TargetAccessScope.RegistryWrite,
      TargetAccessScope.Settings,
    ],
    projectScopes: [ProjectAccessScope.Read],
    organizationScopes: [OrganizationAccessScope.Read, OrganizationAccessScope.Settings],
  });

  const productionToken = await createToken({
    targetScopes: [
      TargetAccessScope.Read,
      TargetAccessScope.RegistryRead,
      TargetAccessScope.RegistryWrite,
    ],
    projectScopes: [ProjectAccessScope.Read],
    organizationScopes: [OrganizationAccessScope.Read],
    targetId: productionTarget.cleanId,
  });

  const schemaPublishResult = await stagingToken
    .publishSchema({
      author: 'Kamil',
      commit: 'usage-check-2',
      sdl: `type Query { ping: String me: String }`,
    })
    .then(r => r.expectNoGraphQLErrors());

  expect((schemaPublishResult.schemaPublish as any).valid).toEqual(true);

  const targetValidationResult = await stagingToken.toggleTargetValidation(true);
  expect(targetValidationResult.setTargetValidation.validationSettings.enabled).toEqual(true);
  expect(targetValidationResult.setTargetValidation.validationSettings.percentage).toEqual(0);
  expect(targetValidationResult.setTargetValidation.validationSettings.period).toEqual(30);

  const collectResult = await productionToken.collectLegacyOperations([
    {
      timestamp: Date.now(),
      operation: 'query ping { ping }',
      operationName: 'ping',
      fields: ['Query', 'Query.ping'],
      execution: {
        ok: true,
        duration: 200_000_000,
        errorsTotal: 0,
      },
      metadata: {},
    },
    {
      timestamp: Date.now(),
      operation: 'query me { me }',
      operationName: 'me',
      fields: ['Query', 'Query.me'],
      execution: {
        ok: true,
        duration: 200_000_000,
        errorsTotal: 0,
      },
    },
    {
      timestamp: Date.now(),
      operation: 'query me { me }',
      operationName: 'me',
      fields: ['Query', 'Query.me'],
      execution: {
        ok: true,
        duration: 200_000_000,
        errorsTotal: 0,
      },
    },
  ]);

  expect(collectResult.status).toEqual(200);
  await waitFor(5000);

  // should not be breaking because the field is unused on staging
  // ping is used but on production
  const unusedCheckResult = await stagingToken
    .checkSchema(`type Query { me: String }`)
    .then(r => r.expectNoGraphQLErrors());
  expect(unusedCheckResult.schemaCheck.__typename).toEqual('SchemaCheckSuccess');

  // Now switch to using checking both staging and production
  const updateValidationResult = await updateTargetValidationSettings(
    {
      organization: organization.cleanId,
      project: project.cleanId,
      target: staging.cleanId,
      percentage: 50, // Out of 3 requests, 1 is for Query.me, 2 are done for Query.me so it's 1/3 = 33.3%
      period: 2,
      targets: [productionTarget.id, staging.id],
    },
    {
      authToken: ownerToken,
    },
  ).then(r => r.expectNoGraphQLErrors());

  expect(updateValidationResult.updateTargetValidationSettings.error).toBeNull();
  expect(
    updateValidationResult.updateTargetValidationSettings.ok!.target.validationSettings.percentage,
  ).toEqual(50);
  expect(
    updateValidationResult.updateTargetValidationSettings.ok!.target.validationSettings.period,
  ).toEqual(2);
  expect(
    updateValidationResult.updateTargetValidationSettings.ok!.target.validationSettings.targets,
  ).toHaveLength(2);

  // should be non-breaking because the field is used in production and we are checking staging and production now
  // and it used in less than 50% of traffic
  // ping is used on production and we do check production now
  const usedCheckResult = await stagingToken
    .checkSchema(`type Query { me: String }`)
    .then(r => r.expectNoGraphQLErrors());

  if (usedCheckResult.schemaCheck.__typename !== 'SchemaCheckSuccess') {
    throw new Error(`Expected SchemaCheckSuccess, got ${usedCheckResult.schemaCheck.__typename}`);
  }

  expect(usedCheckResult.schemaCheck.valid).toEqual(true);
});

test.concurrent('check usage not from excluded client names', async () => {
  const { createOrg, ownerToken } = await initSeed().createOwner();
  const { organization, createProject } = await createOrg();
  const { project, target, createToken } = await createProject(ProjectType.Single);

  const token = await createToken({
    targetScopes: [
      TargetAccessScope.Read,
      TargetAccessScope.RegistryRead,
      TargetAccessScope.RegistryWrite,
      TargetAccessScope.Settings,
    ],
    projectScopes: [ProjectAccessScope.Read],
    organizationScopes: [OrganizationAccessScope.Read],
  });

  const schemaPublishResult = await token
    .publishSchema({
      author: 'Kamil',
      commit: 'usage-check-2',
      sdl: `type Query { ping: String me: String }`,
    })
    .then(r => r.expectNoGraphQLErrors());
  expect((schemaPublishResult.schemaPublish as any).valid).toEqual(true);

  const targetValidationResult = await token.toggleTargetValidation(true);
  expect(targetValidationResult.setTargetValidation.validationSettings.enabled).toEqual(true);
  expect(targetValidationResult.setTargetValidation.validationSettings.percentage).toEqual(0);
  expect(targetValidationResult.setTargetValidation.validationSettings.period).toEqual(30);

  const collectResult = await token.collectLegacyOperations([
    {
      timestamp: Date.now(),
      operation: 'query ping { ping }',
      operationName: 'ping',
      fields: ['Query', 'Query.ping'],
      execution: {
        ok: true,
        duration: 200_000_000,
        errorsTotal: 0,
      },
      metadata: {
        client: {
          name: 'cli',
          version: '2.0.0',
        },
      },
    },
    {
      timestamp: Date.now(),
      operation: 'query me { me }',
      operationName: 'me',
      fields: ['Query', 'Query.me'],
      execution: {
        ok: true,
        duration: 200_000_000,
        errorsTotal: 0,
      },
      metadata: {
        client: {
          name: 'app',
          version: '1.0.0',
        },
      },
    },
    {
      timestamp: Date.now(),
      operation: 'query me { me }',
      operationName: 'me',
      fields: ['Query', 'Query.me'],
      execution: {
        ok: true,
        duration: 200_000_000,
        errorsTotal: 0,
      },
      metadata: {
        client: {
          name: 'app',
          version: '1.0.1',
        },
      },
    },
    {
      timestamp: Date.now(),
      operation: 'query me { me }',
      operationName: 'me',
      fields: ['Query', 'Query.me'],
      execution: {
        ok: true,
        duration: 200_000_000,
        errorsTotal: 0,
      },
      metadata: {
        client: {
          name: 'cli',
          version: '2.0.0',
        },
      },
    },
  ]);
  expect(collectResult.status).toEqual(200);
  await waitFor(5000);

  // should be breaking because the field is used
  // Query.me would be removed, but was requested by cli and app
  const unusedCheckResult = await token
    .checkSchema(`type Query { ping: String }`)
    .then(r => r.expectNoGraphQLErrors());
  expect(unusedCheckResult.schemaCheck.__typename).toEqual('SchemaCheckError');

  // Exclude app from the check (tests partial, incomplete exclusion)
  let updateValidationResult = await updateTargetValidationSettings(
    {
      organization: organization.cleanId,
      project: project.cleanId,
      target: target.cleanId,
      percentage: 0,
      period: 2,
      targets: [target.id],
      excludedClients: ['app'],
    },
    {
      authToken: ownerToken,
    },
  ).then(r => r.expectNoGraphQLErrors());

  expect(updateValidationResult.updateTargetValidationSettings.error).toBeNull();
  expect(
    updateValidationResult.updateTargetValidationSettings.ok!.target.validationSettings.enabled,
  ).toBe(true);
  expect(
    updateValidationResult.updateTargetValidationSettings.ok!.target.validationSettings
      .excludedClients,
  ).toHaveLength(1);
  expect(
    updateValidationResult.updateTargetValidationSettings.ok!.target.validationSettings
      .excludedClients,
  ).toContainEqual('app');

  // should be unsafe because though we excluded 'app', 'cli' still uses this
  // Query.me would be removed, but was requested by cli and app
  const unusedCheckResult2 = await token
    .checkSchema(`type Query { ping: String }`)
    .then(r => r.expectNoGraphQLErrors());
  expect(unusedCheckResult2.schemaCheck.__typename).toEqual('SchemaCheckError');

  // Exclude BOTH 'app' and 'cli' (tests multi client covering exclusion)
  updateValidationResult = await updateTargetValidationSettings(
    {
      organization: organization.cleanId,
      project: project.cleanId,
      target: target.cleanId,
      percentage: 0,
      period: 2,
      targets: [target.id],
      excludedClients: ['app', 'cli'],
    },
    {
      authToken: ownerToken,
    },
  ).then(r => r.expectNoGraphQLErrors());
  expect(
    updateValidationResult.updateTargetValidationSettings.ok!.target.validationSettings
      .excludedClients,
  ).toContainEqual('app');
  expect(
    updateValidationResult.updateTargetValidationSettings.ok!.target.validationSettings
      .excludedClients,
  ).toContainEqual('cli');

  // should be safe because the field was not used by the non-excluded clients
  // Query.me would be removed, but was requested by cli and app
  const usedCheckResult = await (
    await token.checkSchema(`type Query { ping: String }`)
  ).expectNoGraphQLErrors();

  if (usedCheckResult.schemaCheck.__typename !== 'SchemaCheckSuccess') {
    throw new Error(`Expected SchemaCheckSuccess, got ${usedCheckResult.schemaCheck.__typename}`);
  }

  expect(usedCheckResult.schemaCheck.valid).toEqual(true);
});

describe('changes with usage data', () => {
  function testChangesWithUsageData(input: {
    title: string;
    publishSdl: string;
    checkSdl: string;
    reportOperation: {
      operation: string;
      operationName: string;
      fields: string[];
    };
    expectedSchemaCheckTypename: {
      beforeReportedOperation: 'SchemaCheckSuccess' | 'SchemaCheckError';
      afterReportedOperation: 'SchemaCheckSuccess' | 'SchemaCheckError';
    };
  }) {
    test.concurrent(input.title, async () => {
      const { createOrg } = await initSeed().createOwner();
      const { createProject } = await createOrg();
      const { target, createToken } = await createProject(ProjectType.Single);

      const token = await createToken({
        targetScopes: [
          TargetAccessScope.Read,
          TargetAccessScope.RegistryRead,
          TargetAccessScope.RegistryWrite,
          TargetAccessScope.Settings,
        ],
        projectScopes: [ProjectAccessScope.Read],
        organizationScopes: [OrganizationAccessScope.Read],
        targetId: target.cleanId,
      });

      const schemaPublishResult = await token
        .publishSchema({
          author: 'Kamil',
          commit: 'initial',
          sdl: input.publishSdl,
        })
        .then(r => r.expectNoGraphQLErrors());

      expect((schemaPublishResult.schemaPublish as any).valid).toEqual(true);

      await expect(
        token
          .checkSchema(input.checkSdl)
          .then(r => r.expectNoGraphQLErrors())
          .then(r => r.schemaCheck.__typename),
      ).resolves.toBe(input.expectedSchemaCheckTypename.beforeReportedOperation);

      const targetValidationResult = await token.toggleTargetValidation(true);
      expect(targetValidationResult.setTargetValidation.validationSettings.enabled).toEqual(true);
      expect(targetValidationResult.setTargetValidation.validationSettings.percentage).toEqual(0);
      expect(targetValidationResult.setTargetValidation.validationSettings.period).toEqual(30);

      const collectResult = await token.collectLegacyOperations([
        {
          timestamp: Date.now(),
          operation: input.reportOperation.operation,
          operationName: input.reportOperation.operationName,
          fields: input.reportOperation.fields,
          execution: {
            ok: true,
            duration: 200_000_000,
            errorsTotal: 0,
          },
          metadata: {},
        },
      ]);

      expect(collectResult.status).toEqual(200);
      await waitFor(5000);

      await expect(
        token
          .checkSchema(input.checkSdl)
          .then(r => r.expectNoGraphQLErrors())
          .then(r => r.schemaCheck.__typename),
      ).resolves.toEqual(input.expectedSchemaCheckTypename.afterReportedOperation);
    });
  }

  testChangesWithUsageData({
    title: 'add non-nullable input field to used input object',
    publishSdl: /* GraphQL */ `
      type Query {
        users(filter: Filter): [String]
      }

      input Filter {
        limit: Int
      }
    `,
    checkSdl: /* GraphQL */ `
      type Query {
        users(filter: Filter): [String]
      }

      input Filter {
        limit: Int
        first: Int!
      }
    `,
    reportOperation: {
      operation: 'query users { users(filter: { limit: 5 }) }',
      operationName: 'users',
      fields: ['Query', 'Query.users', 'Filter', 'Filter.limit'],
    },
    expectedSchemaCheckTypename: {
      // should be breaking because the input object type with new non-nullable field
      beforeReportedOperation: 'SchemaCheckError',
      // should be breaking because the input object type is used
      afterReportedOperation: 'SchemaCheckError',
    },
  });

  testChangesWithUsageData({
    title: 'add nullable input field to used input object',
    publishSdl: /* GraphQL */ `
      type Query {
        users(filter: Filter): [String]
      }

      input Filter {
        limit: Int
      }
    `,
    checkSdl: /* GraphQL */ `
      type Query {
        users(filter: Filter): [String]
      }

      input Filter {
        limit: Int
        first: Int
      }
    `,
    expectedSchemaCheckTypename: {
      // should be safe, because it's nullable field and does not require user to provide it
      beforeReportedOperation: 'SchemaCheckSuccess',
      // should be safe, for the same reason
      afterReportedOperation: 'SchemaCheckSuccess',
    },
    reportOperation: {
      operation: 'query users { users(filter: { limit: 5 }) }',
      operationName: 'users',
      fields: ['Query', 'Query.users', 'Filter', 'Filter.limit'],
    },
  });

  testChangesWithUsageData({
    title: 'make nullable input field non-nullable of an used input object',
    publishSdl: /* GraphQL */ `
      type Query {
        users(filter: Filter): [String]
      }

      input Filter {
        limit: Int
      }
    `,
    checkSdl: /* GraphQL */ `
      type Query {
        users(filter: Filter): [String]
      }

      input Filter {
        limit: Int!
      }
    `,
    expectedSchemaCheckTypename: {
      // should be breaking, because it requires an action from user
      beforeReportedOperation: 'SchemaCheckError',
      // should be breaking, because it requires an action from user
      afterReportedOperation: 'SchemaCheckError',
    },
    reportOperation: {
      operation: 'query users { users(filter: { limit: 5 }) }',
      operationName: 'users',
      fields: ['Query', 'Query.users', 'Filter', 'Filter.limit'],
    },
  });

  testChangesWithUsageData({
    title: 'make non-nullable input nullable of an used input object',
    publishSdl: /* GraphQL */ `
      type Query {
        users(filter: Filter): [String]
      }

      input Filter {
        limit: Int!
      }
    `,
    checkSdl: /* GraphQL */ `
      type Query {
        users(filter: Filter): [String]
      }

      input Filter {
        limit: Int
      }
    `,
    expectedSchemaCheckTypename: {
      // should be safe, as it does not require any action from user
      beforeReportedOperation: 'SchemaCheckSuccess',
      // should be safe, as it does not require any action from user
      afterReportedOperation: 'SchemaCheckSuccess',
    },
    reportOperation: {
      operation: 'query users { users(filter: { limit: 5 }) }',
      operationName: 'users',
      fields: ['Query', 'Query.users', 'Filter', 'Filter.limit'],
    },
  });

  testChangesWithUsageData({
    title: 'modify type of a non-nullable input field of an used input object',
    publishSdl: /* GraphQL */ `
      type Query {
        users(filter: Filter): [String]
      }

      input Filter {
        limit: Int
        skip: Int!
      }
    `,
    checkSdl: /* GraphQL */ `
      type Query {
        users(filter: Filter): [String]
      }

      input Filter {
        limit: Int
        skip: String!
      }
    `,
    expectedSchemaCheckTypename: {
      // should be breaking, because it's non-nullable field
      beforeReportedOperation: 'SchemaCheckError',
      // should be safe. Even though it's non-nullable field and the input object type is used
      // BUT the field was NOT reported yet!
      afterReportedOperation: 'SchemaCheckSuccess',
    },
    reportOperation: {
      operation: 'query users { users(filter: { limit: 5 }) }',
      operationName: 'users',
      fields: ['Query', 'Query.users', 'Filter', 'Filter.limit'],
    },
  });

  testChangesWithUsageData({
    title: 'modify type of a nullable input field of an used input object',
    publishSdl: /* GraphQL */ `
      type Query {
        users(filter: Filter): [String]
      }

      input Filter {
        limit: Int
        skip: Int
      }
    `,
    checkSdl: /* GraphQL */ `
      type Query {
        users(filter: Filter): [String]
      }

      input Filter {
        limit: Int
        skip: String
      }
    `,
    expectedSchemaCheckTypename: {
      // should be breaking, because it changes the type of the field
      beforeReportedOperation: 'SchemaCheckError',
      // should be safe, because Filter.skip is not used and it's nullable
      afterReportedOperation: 'SchemaCheckSuccess',
    },
    reportOperation: {
      operation: 'query users { users(filter: { limit: 5 }) }',
      operationName: 'users',
      fields: ['Query', 'Query.users', 'Filter', 'Filter.limit'],
    },
  });
});

test.concurrent('number of produced and collected operations should match', async () => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject } = await createOrg();
  const { target, createToken } = await createProject(ProjectType.Single);
  const writeToken = await createToken({
    targetScopes: [
      TargetAccessScope.Read,
      TargetAccessScope.RegistryRead,
      TargetAccessScope.RegistryWrite,
    ],
    projectScopes: [ProjectAccessScope.Read],
    organizationScopes: [OrganizationAccessScope.Read],
  });

  const batchSize = 1000;
  const totalAmount = 10_000;

  for await (const i of new Array(totalAmount / batchSize).fill(null).map((_, i) => i)) {
    await writeToken.collectLegacyOperations(
      prepareBatch(
        batchSize,
        i % 2 === 0
          ? {
              operation: 'query ping { ping }',
              operationName: 'ping',
              fields: ['Query', 'Query.ping'],
              execution: {
                ok: true,
                duration: 200_000_000,
                errorsTotal: 0,
              },
            }
          : {
              operation: 'query ping { ping }',
              operationName: 'ping',
              fields: ['Query', 'Query.ping'],
              execution: {
                ok: true,
                duration: 200_000_000,
                errorsTotal: 0,
              },
              metadata: {
                client: {
                  name: 'web',
                  version: '1.2.3',
                },
              },
            },
      ),
    );
  }

  await waitFor(5000);

  const result = await clickHouseQuery<{
    target: string;
    client_name: string | null;
    hash: string;
    total: number;
  }>(`
    SELECT
      target, client_name, hash, sum(total) as total
    FROM clients_daily
    WHERE 
      timestamp >= subtractDays(now(), 30)
      AND timestamp <= now()
      AND target = '${target.id}'
    GROUP BY target, client_name, hash
  `);

  expect(result.rows).toEqual(2);
  expect(result.data).toContainEqual(
    expect.objectContaining({
      target: target.id,
      client_name: 'web',
      hash: expect.any(String),
      total: expect.stringMatching('5000'),
    }),
  );
  expect(result.data).toContainEqual(
    expect.objectContaining({
      target: target.id,
      client_name: '',
      hash: expect.any(String),
      total: expect.stringMatching('5000'),
    }),
  );
});

test.concurrent(
  'different order of schema coordinates should not result in different hash',
  async () => {
    const { createOrg } = await initSeed().createOwner();
    const { createProject } = await createOrg();
    const { target, createToken } = await createProject(ProjectType.Single);
    const writeToken = await createToken({
      targetScopes: [
        TargetAccessScope.Read,
        TargetAccessScope.RegistryRead,
        TargetAccessScope.RegistryWrite,
      ],
      projectScopes: [ProjectAccessScope.Read],
      organizationScopes: [OrganizationAccessScope.Read],
    });

    await writeToken.collectLegacyOperations([
      {
        operation: 'query ping {        ping      }', // those spaces are expected and important to ensure normalization is in place
        operationName: 'ping',
        fields: ['Query', 'Query.ping'],
        execution: {
          ok: true,
          duration: 200_000_000,
          errorsTotal: 0,
        },
      },
      {
        operation: 'query ping { ping }',
        operationName: 'ping',
        fields: ['Query.ping', 'Query'],
        execution: {
          ok: true,
          duration: 200_000_000,
          errorsTotal: 0,
        },
      },
    ]);

    await waitFor(5000);

    const coordinatesResult = await clickHouseQuery<{
      target: string;
      client_name: string | null;
      hash: string;
      total: number;
    }>(`
    SELECT coordinate, hash FROM coordinates_daily WHERE target = '${target.id}' GROUP BY coordinate, hash
  `);

    expect(coordinatesResult.rows).toEqual(2);

    const operationCollectionResult = await clickHouseQuery<{
      target: string;
      client_name: string | null;
      hash: string;
      total: number;
    }>(`SELECT hash FROM operation_collection WHERE target = '${target.id}' GROUP BY hash`);

    expect(operationCollectionResult.rows).toEqual(1);
  },
);

test.concurrent(
  'same operation but with different schema coordinates should result in different hash',
  async () => {
    const { createOrg } = await initSeed().createOwner();
    const { createProject } = await createOrg();
    const { target, createToken } = await createProject(ProjectType.Single);
    const writeToken = await createToken({
      targetScopes: [
        TargetAccessScope.Read,
        TargetAccessScope.RegistryRead,
        TargetAccessScope.RegistryWrite,
      ],
      projectScopes: [ProjectAccessScope.Read],
      organizationScopes: [OrganizationAccessScope.Read],
    });

    await writeToken.collectLegacyOperations([
      {
        operation: 'query ping {        ping      }', // those spaces are expected and important to ensure normalization is in place
        operationName: 'ping',
        fields: ['Query', 'Query.ping'],
        execution: {
          ok: true,
          duration: 200_000_000,
          errorsTotal: 0,
        },
      },
      {
        operation: 'query ping { ping }',
        operationName: 'ping',
        fields: ['RootQuery', 'RootQuery.ping'],
        execution: {
          ok: true,
          duration: 200_000_000,
          errorsTotal: 0,
        },
      },
    ]);

    await waitFor(5000);

    const coordinatesResult = await clickHouseQuery<{
      coordinate: string;
      hash: string;
    }>(`
    SELECT coordinate, hash FROM coordinates_daily WHERE target = '${target.id}' GROUP BY coordinate, hash
  `);

    expect(coordinatesResult.rows).toEqual(4);

    const operationCollectionResult = await clickHouseQuery<{
      hash: string;
    }>(`SELECT hash FROM operation_collection WHERE target = '${target.id}' GROUP BY hash`);

    expect(operationCollectionResult.rows).toEqual(2);

    const operationsResult = await clickHouseQuery<{
      target: string;
      client_name: string | null;
      hash: string;
      total: number;
    }>(`SELECT hash FROM operation_collection WHERE target = '${target.id}' GROUP BY hash`);

    expect(operationsResult.rows).toEqual(2);
  },
);

test.concurrent(
  'operations with the same schema coordinates and body but with different name should result in different hashes',
  async () => {
    const { createOrg } = await initSeed().createOwner();
    const { createProject } = await createOrg();
    const { target, createToken } = await createProject(ProjectType.Single);
    const writeToken = await createToken({
      targetScopes: [
        TargetAccessScope.Read,
        TargetAccessScope.RegistryRead,
        TargetAccessScope.RegistryWrite,
      ],
      projectScopes: [ProjectAccessScope.Read],
      organizationScopes: [OrganizationAccessScope.Read],
    });

    await writeToken.collectLegacyOperations([
      {
        operation: 'query pingv2 { ping }',
        operationName: 'pingv2',
        fields: ['Query', 'Query.ping'],
        execution: {
          ok: true,
          duration: 200_000_000,
          errorsTotal: 0,
        },
      },
      {
        operation: 'query ping { ping }',
        operationName: 'ping',
        fields: ['Query', 'Query.ping'],
        execution: {
          ok: true,
          duration: 200_000_000,
          errorsTotal: 0,
        },
      },
    ]);

    await waitFor(5000);

    const coordinatesResult = await clickHouseQuery<{
      target: string;
      client_name: string | null;
      hash: string;
      total: number;
    }>(`
    SELECT coordinate, hash FROM coordinates_daily WHERE target = '${target.id}' GROUP BY coordinate, hash
  `);

    expect(coordinatesResult.rows).toEqual(4);

    const operationsResult = await clickHouseQuery<{
      target: string;
      client_name: string | null;
      hash: string;
      total: number;
    }>(`SELECT hash FROM operation_collection WHERE target = '${target.id}' GROUP BY hash`);

    expect(operationsResult.rows).toEqual(2);
  },
);

test.concurrent('ignore operations with syntax errors', async () => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject } = await createOrg();
  const { target, createToken } = await createProject(ProjectType.Single);
  const writeToken = await createToken({
    targetScopes: [
      TargetAccessScope.Read,
      TargetAccessScope.RegistryRead,
      TargetAccessScope.RegistryWrite,
    ],
    projectScopes: [ProjectAccessScope.Read],
    organizationScopes: [OrganizationAccessScope.Read],
  });

  const collectResult = await writeToken.collectLegacyOperations([
    {
      operation: 'query pingv2 { pingv2 }',
      operationName: 'pingv2',
      fields: ['Query', 'Query.pingv2'],
      execution: {
        ok: true,
        duration: 200_000_000,
        errorsTotal: 0,
      },
    },
    {
      operation: 'query ping ping }',
      operationName: 'ping',
      fields: ['Query', 'Query.ping'],
      execution: {
        ok: true,
        duration: 200_000_000,
        errorsTotal: 0,
      },
    },
  ]);

  expect(collectResult.status).toEqual(200);
  expect(typeof collectResult.body !== 'string' && collectResult.body.operations).toEqual(
    expect.objectContaining({
      rejected: 1,
      accepted: 1,
    }),
  );

  await waitFor(5000);

  const coordinatesResult = await clickHouseQuery<{
    target: string;
    client_name: string | null;
    hash: string;
    total: number;
  }>(`
    SELECT coordinate, hash FROM coordinates_daily WHERE target = '${target.id}' GROUP BY coordinate, hash
  `);

  expect(coordinatesResult.rows).toEqual(2);

  const operationsResult = await clickHouseQuery<{
    target: string;
    client_name: string | null;
    hash: string;
    total: number;
  }>(`SELECT hash FROM operation_collection WHERE target = '${target.id}' GROUP BY hash`);

  expect(operationsResult.rows).toEqual(1);
});

test.concurrent('ensure correct data', async () => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject } = await createOrg();
  const { target, createToken } = await createProject(ProjectType.Single);
  const writeToken = await createToken({
    targetScopes: [
      TargetAccessScope.Read,
      TargetAccessScope.RegistryRead,
      TargetAccessScope.RegistryWrite,
    ],
    projectScopes: [ProjectAccessScope.Read],
    organizationScopes: [OrganizationAccessScope.Read],
  });

  await writeToken.collectLegacyOperations([
    {
      operation: 'query ping {        ping      }', // those spaces are expected and important to ensure normalization is in place
      operationName: 'ping',
      fields: ['Query', 'Query.ping'],
      execution: {
        ok: true,
        duration: 200_000_000,
        errorsTotal: 0,
      },
    },
    {
      operation: 'query ping { ping }',
      operationName: 'ping',
      fields: ['Query', 'Query.ping'],
      execution: {
        ok: true,
        duration: 200_000_000,
        errorsTotal: 0,
      },
      metadata: {
        client: {
          name: 'test-name',
          version: 'test-version',
        },
      },
    },
  ]);

  await waitFor(5000);

  // operation_collection
  const operationCollectionResult = await clickHouseQuery<{
    target: string;
    hash: string;
    name: string;
    body: string;
    operation_kind: string;
    coordinates: string[];
    total: string;
    timestamp: string;
    expires_at: string;
  }>(`
    SELECT
      target,
      hash,
      name,
      body,
      operation_kind,
      sum(total) as total,
      coordinates
    FROM operation_collection
    WHERE target = '${target.id}'
    GROUP BY target, hash, coordinates, name, body, operation_kind
  `);

  expect(operationCollectionResult.data).toHaveLength(1);

  const operationCollectionRow = operationCollectionResult.data[0];
  expect(operationCollectionRow.body).toEqual('query ping{ping}');
  expect(operationCollectionRow.coordinates).toHaveLength(2);
  expect(operationCollectionRow.coordinates).toContainEqual('Query.ping');
  expect(operationCollectionRow.coordinates).toContainEqual('Query');
  expect(operationCollectionRow.hash).toHaveLength(32);
  expect(operationCollectionRow.name).toBe('ping');
  expect(operationCollectionRow.target).toBe(target.id);
  expect(ensureNumber(operationCollectionRow.total)).toEqual(2);

  // operations
  const operationsResult = await clickHouseQuery<{
    target: string;
    timestamp: string;
    expires_at: string;
    hash: string;
    ok: boolean;
    errors: number;
    duration: number;
    client_name: string;
    client_version: string;
  }>(`
    SELECT
      target,
      timestamp,
      expires_at,
      hash,
      ok,
      errors,
      duration,
      client_name,
      client_version
    FROM operations
    WHERE target = '${target.id}'
  `);

  expect(operationsResult.data).toHaveLength(2);

  const operationWithClient = operationsResult.data.find(o => o.client_name.length > 0)!;
  expect(operationWithClient).toBeDefined();
  expect(operationWithClient.client_name).toEqual('test-name');
  expect(operationWithClient.client_version).toEqual('test-version');
  expect(ensureNumber(operationWithClient.duration)).toEqual(200_000_000);
  expect(ensureNumber(operationWithClient.errors)).toEqual(0);
  expect(operationWithClient.hash).toHaveLength(32);
  expect(operationWithClient.target).toEqual(target.id);

  const operationWithoutClient = operationsResult.data.find(o => o.client_name.length === 0)!;
  expect(operationWithoutClient).toBeDefined();
  expect(operationWithoutClient.client_name).toHaveLength(0);
  expect(operationWithoutClient.client_version).toHaveLength(0);
  expect(ensureNumber(operationWithoutClient.duration)).toEqual(200_000_000);
  expect(ensureNumber(operationWithoutClient.errors)).toEqual(0);
  expect(operationWithoutClient.hash).toHaveLength(32);
  expect(operationWithoutClient.target).toEqual(target.id);

  // operations_hourly
  const operationsHourlyResult = await clickHouseQuery<{
    target: string;
    hash: string;
    total_ok: string;
    total: string;
    quantiles: [number];
  }>(`
    SELECT
      target,
      sum(total) as total,
      sum(total_ok) as total_ok,
      hash,
      quantilesMerge(0.99)(duration_quantiles) as quantiles
    FROM operations_hourly
    WHERE target = '${target.id}'
    GROUP BY target, hash
  `);

  expect(operationsHourlyResult.data).toHaveLength(1);

  const hourlyAgg = operationsHourlyResult.data[0];
  expect(hourlyAgg).toBeDefined();
  expect(ensureNumber(hourlyAgg.quantiles[0])).toEqual(200_000_000);
  expect(ensureNumber(hourlyAgg.total)).toEqual(2);
  expect(ensureNumber(hourlyAgg.total_ok)).toEqual(2);
  expect(hourlyAgg.hash).toHaveLength(32);
  expect(hourlyAgg.target).toEqual(target.id);

  // operations_daily
  const operationsDailyResult = await clickHouseQuery<{
    target: string;
    hash: string;
    total_ok: string;
    total: string;
    quantiles: [number];
  }>(`
    SELECT
      target,
      sum(total) as total,
      sum(total_ok) as total_ok,
      hash,
      quantilesMerge(0.99)(duration_quantiles) as quantiles
    FROM operations_daily 
    WHERE target = '${target.id}'
    GROUP BY target, hash
  `);

  expect(operationsDailyResult.data).toHaveLength(1);

  const dailyAgg = operationsDailyResult.data[0];
  expect(dailyAgg).toBeDefined();
  expect(ensureNumber(dailyAgg.quantiles[0])).toEqual(200_000_000);
  expect(ensureNumber(dailyAgg.total)).toEqual(2);
  expect(ensureNumber(dailyAgg.total_ok)).toEqual(2);
  expect(dailyAgg.hash).toHaveLength(32);
  expect(dailyAgg.target).toEqual(target.id);

  // coordinates_daily
  const coordinatesDailyResult = await clickHouseQuery<{
    target: string;
    hash: string;
    total: string;
    coordinate: string;
  }>(`
    SELECT
      target,
      sum(total) as total,
      hash,
      coordinate
    FROM coordinates_daily 
    WHERE target = '${target.id}'
    GROUP BY target, hash, coordinate
  `);

  expect(coordinatesDailyResult.data).toHaveLength(2);

  const rootCoordinate = coordinatesDailyResult.data.find(c => c.coordinate === 'Query')!;
  expect(rootCoordinate).toBeDefined();
  expect(ensureNumber(rootCoordinate.total)).toEqual(2);
  expect(rootCoordinate.hash).toHaveLength(32);
  expect(rootCoordinate.target).toEqual(target.id);

  const fieldCoordinate = coordinatesDailyResult.data.find(c => c.coordinate === 'Query.ping')!;
  expect(fieldCoordinate).toBeDefined();
  expect(ensureNumber(fieldCoordinate.total)).toEqual(2);
  expect(fieldCoordinate.hash).toHaveLength(32);
  expect(fieldCoordinate.target).toEqual(target.id);

  // clients_daily
  const clientsDailyResult = await clickHouseQuery<{
    target: string;
    hash: string;
    client_name: string;
    client_version: string;
    total: string;
  }>(`
    SELECT
      target,
      sum(total) as total,
      hash,
      client_name,
      client_version
    FROM clients_daily
    WHERE target = '${target.id}'
    GROUP BY target, hash, client_name, client_version
  `);

  expect(clientsDailyResult.data).toHaveLength(2);

  const dailyAggOfKnownClient = clientsDailyResult.data.find(c => c.client_name === 'test-name')!;
  expect(dailyAggOfKnownClient).toBeDefined();
  expect(ensureNumber(dailyAggOfKnownClient.total)).toEqual(1);
  expect(dailyAggOfKnownClient.client_version).toBe('test-version');
  expect(dailyAggOfKnownClient.hash).toHaveLength(32);
  expect(dailyAggOfKnownClient.target).toEqual(target.id);

  const dailyAggOfUnknownClient = clientsDailyResult.data.find(c => c.client_name !== 'test-name')!;
  expect(dailyAggOfUnknownClient).toBeDefined();
  expect(ensureNumber(dailyAggOfUnknownClient.total)).toEqual(1);
  expect(dailyAggOfUnknownClient.client_version).toHaveLength(0);
  expect(dailyAggOfUnknownClient.hash).toHaveLength(32);
  expect(dailyAggOfUnknownClient.target).toEqual(target.id);
});

const SubscriptionSchemaCheckQuery = graphql(/* GraphQL */ `
  query SubscriptionSchemaCheck($selector: TargetSelectorInput!, $id: ID!) {
    target(selector: $selector) {
      schemaCheck(id: $id) {
        __typename
        id
        breakingSchemaChanges {
          nodes {
            criticality
            criticalityReason
            message
            path
            isSafeBasedOnUsage
            usageStatistics {
              topAffectedOperations {
                hash
                name
                countFormatted
                percentageFormatted
              }
              topAffectedClients {
                name
                countFormatted
                percentageFormatted
              }
            }
            approval {
              schemaCheckId
              approvedAt
              approvedBy {
                id
                displayName
              }
            }
          }
        }
      }
    }
  }
`);

test.concurrent(
  'subscription operation is used for conditional breaking change detection',
  async () => {
    const { createOrg } = await initSeed().createOwner();
    const { organization, createProject } = await createOrg();
    const { project, target, createToken } = await createProject(ProjectType.Single);
    const token = await createToken({
      targetScopes: [
        TargetAccessScope.Read,
        TargetAccessScope.RegistryRead,
        TargetAccessScope.RegistryWrite,
        TargetAccessScope.Settings,
      ],
      projectScopes: [ProjectAccessScope.Read],
      organizationScopes: [OrganizationAccessScope.Read],
    });

    const sdl = /* GraphQL */ `
      type Query {
        a: String
        b: String
      }

      type Subscription {
        a: String
        b: String
      }
    `;

    const schemaPublishResult = await token
      .publishSchema({
        sdl,
        author: 'Kamil',
        commit: 'initial',
      })
      .then(res => res.expectNoGraphQLErrors());

    expect(schemaPublishResult.schemaPublish.__typename).toEqual('SchemaPublishSuccess');

    await token.toggleTargetValidation(true);

    const usageAddress = await getServiceHost('usage', 8081);

    const client = createHive({
      enabled: true,
      token: token.secret,
      usage: true,
      debug: false,
      agent: {
        logger: createLogger('debug'),
        maxSize: 1,
      },
      selfHosting: {
        usageEndpoint: 'http://' + usageAddress,
        graphqlEndpoint: 'http://noop/',
        applicationUrl: 'http://noop/',
      },
    });

    const request = new Request('http://localhost:4000/graphql', {
      method: 'POST',
      headers: {
        'x-graphql-client-name': 'integration-tests',
        'x-graphql-client-version': '6.6.6',
      },
    });

    client.collectSubscriptionUsage({
      args: {
        document: parse(/* GraphQL */ `
          subscription {
            a
          }
        `),
        schema: buildASTSchema(parse(sdl)),
        contextValue: {
          request,
        },
      },
    });

    await waitFor(5000);

    const result = await token
      .checkSchema(/* GraphQL */ `
        type Query {
          a: String
          b: String
        }

        type Subscription {
          b: String
        }
      `)
      .then(r => r.expectNoGraphQLErrors());

    if (result.schemaCheck.__typename !== 'SchemaCheckError') {
      throw new Error(`Expected SchemaCheckError, got ${result.schemaCheck.__typename}`);
    }

    expect(result.schemaCheck.errors).toEqual({
      nodes: [
        {
          message: "Field 'a' was removed from object type 'Subscription'",
        },
      ],
      total: 1,
    });

    const schemaCheckId = result.schemaCheck.schemaCheck?.id;

    if (!schemaCheckId) {
      throw new Error('Expected schemaCheckId to be defined');
    }

    const schemaCheck = await execute({
      document: SubscriptionSchemaCheckQuery,
      variables: {
        id: schemaCheckId,
        selector: {
          organization: organization.cleanId,
          project: project.cleanId,
          target: target.cleanId,
        },
      },
      authToken: token.secret,
    }).then(r => r.expectNoGraphQLErrors());

    const node = schemaCheck.target?.schemaCheck?.breakingSchemaChanges?.nodes[0];

    if (!node) {
      throw new Error('Expected node to be defined');
    }
    expect(node.isSafeBasedOnUsage).toEqual(false);
    expect(node.usageStatistics?.topAffectedOperations).toEqual([
      {
        countFormatted: '1',
        hash: 'c1bbc8385a4a6f4e4988be7394800adc',
        name: 'anonymous',
        percentageFormatted: '100.00%',
      },
    ]);
    expect(node.usageStatistics?.topAffectedClients).toEqual([
      {
        countFormatted: '1',
        name: 'integration-tests',
        percentageFormatted: '100.00%',
      },
    ]);
  },
);
