import { differenceInHours } from 'date-fns/differenceInHours';
import { formatISO } from 'date-fns/formatISO';
import { parse as parseDate } from 'date-fns/parse';
import { subHours } from 'date-fns/subHours';
import { buildASTSchema, buildSchema, parse, print, TypeInfo } from 'graphql';
import { createLogger } from 'graphql-yoga';
import { graphql } from 'testkit/gql';
import {
  OrganizationAccessScope,
  ProjectAccessScope,
  ProjectType,
  TargetAccessScope,
} from 'testkit/gql/graphql';
import { execute } from 'testkit/graphql';
import { getServiceHost } from 'testkit/utils';
import { UTCDate } from '@date-fns/utc';
// eslint-disable-next-line hive/enforce-deps-in-dev
import { normalizeOperation } from '@graphql-hive/core';
import { createHive } from '../../../../packages/libraries/core/src';
import { collectSchemaCoordinates } from '../../../../packages/libraries/core/src/client/collect-schema-coordinates';
import { clickHouseQuery } from '../../../testkit/clickhouse';
import { createTarget, updateTargetValidationSettings, waitFor } from '../../../testkit/flow';
import { initSeed } from '../../../testkit/seed';
import { CollectedOperation } from '../../../testkit/usage';

// We don't use differenceInDays from date-fns as it calculates the difference in days
// based on daylight savings time, which is not what we want here.
function differenceInDays(dateLeft: Date, dateRight: Date): number {
  // https://github.com/date-fns/date-fns/blob/ddb34e0833f55020d90a1e6ccb682df3265337d6/src/differenceInDays/index.ts#L17-L18
  return Math.trunc(differenceInHours(dateLeft, dateRight) / 24) | 0;
}

function parseClickHouseDate(date: string) {
  return parseDate(date, 'yyyy-MM-dd HH:mm:ss', new UTCDate());
}

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
  async ({ expect }) => {
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
    await waitFor(8000);

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

test.concurrent(
  'normalize and collect operation without breaking its syntax',
  async ({ expect }) => {
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
    await waitFor(8000);

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
  },
);

test.concurrent(
  'number of produced and collected operations should match (no errors)',
  async ({ expect }) => {
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

    await waitFor(8000);

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

test.concurrent('check usage from two selected targets', async ({ expect }) => {
  const { createOrg, ownerToken } = await initSeed().createOwner();
  const { organization, createProject } = await createOrg();
  const { project, target: staging, createToken } = await createProject(ProjectType.Single);

  const productionTargetResult = await createTarget(
    {
      slug: 'target2',
      organizationSlug: organization.slug,
      projectSlug: project.slug,
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
    target: productionTarget,
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
  await waitFor(8000);

  // should not be breaking because the field is unused on staging
  // ping is used but on production
  const unusedCheckResult = await stagingToken
    .checkSchema(`type Query { me: String }`)
    .then(r => r.expectNoGraphQLErrors());
  expect(unusedCheckResult.schemaCheck.__typename).toEqual('SchemaCheckSuccess');

  // Now switch to using checking both staging and production
  const updateValidationResult = await updateTargetValidationSettings(
    {
      organizationSlug: organization.slug,
      projectSlug: project.slug,
      targetSlug: staging.slug,
      percentage: 50, // Out of 3 requests, 1 is for Query.me, 2 are done for Query.me so it's 1/3 = 33.3%
      period: 2,
      targetIds: [productionTarget.id, staging.id],
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

test.concurrent('check usage not from excluded client names', async ({ expect }) => {
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
  await waitFor(8000);

  // should be breaking because the field is used
  // Query.me would be removed, but was requested by cli and app
  const unusedCheckResult = await token
    .checkSchema(`type Query { ping: String }`)
    .then(r => r.expectNoGraphQLErrors());
  expect(unusedCheckResult.schemaCheck.__typename).toEqual('SchemaCheckError');

  // Exclude app from the check (tests partial, incomplete exclusion)
  let updateValidationResult = await updateTargetValidationSettings(
    {
      organizationSlug: organization.slug,
      projectSlug: project.slug,
      targetSlug: target.slug,
      percentage: 0,
      period: 2,
      targetIds: [target.id],
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
      organizationSlug: organization.slug,
      projectSlug: project.slug,
      targetSlug: target.slug,
      percentage: 0,
      period: 2,
      targetIds: [target.id],
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
      fields: string[] | 'auto-collect';
    };
    expectedSchemaCheckTypename: {
      beforeReportedOperation: 'SchemaCheckSuccess' | 'SchemaCheckError';
      afterReportedOperation: 'SchemaCheckSuccess' | 'SchemaCheckError';
    };
  }) {
    test.concurrent(input.title, async ({ expect }) => {
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
        target,
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

      let fields: string[] = [];

      if (input.reportOperation.fields === 'auto-collect') {
        const schema = buildSchema(input.publishSdl);
        fields = Array.from(
          collectSchemaCoordinates({
            documentNode: parse(input.reportOperation.operation),
            variables: null,
            processVariables: false,
            schema,
            typeInfo: new TypeInfo(schema),
          }),
        );
      } else {
        fields = input.reportOperation.fields;
      }

      const collectResult = await token.collectLegacyOperations([
        {
          timestamp: Date.now(),
          operation: input.reportOperation.operation,
          operationName: input.reportOperation.operationName,
          fields,
          execution: {
            ok: true,
            duration: 200_000_000,
            errorsTotal: 0,
          },
          metadata: {},
        },
      ]);

      expect(collectResult.status).toEqual(200);
      await waitFor(8000);

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

  testChangesWithUsageData({
    title: 'removing an unused union member is safe',
    publishSdl: /* GraphQL */ `
      type Query {
        media: Media
      }

      union Media = Image | Video

      type Image {
        url: String
      }

      type Video {
        url: String
      }
    `,
    checkSdl: /* GraphQL */ `
      type Query {
        media: Media
      }

      union Media = Image

      type Image {
        url: String
      }
    `,
    expectedSchemaCheckTypename: {
      // should be breaking, because it changes the type of the field
      beforeReportedOperation: 'SchemaCheckError',
      // should be safe, because union member is not used
      afterReportedOperation: 'SchemaCheckSuccess',
    },
    reportOperation: {
      operation: 'query imageOnly { media { ... on Image { url } } }',
      operationName: 'imageOnly',
      fields: 'auto-collect',
    },
  });

  testChangesWithUsageData({
    title: 'removing an unused union member is safe (__typename in fragment)',
    publishSdl: /* GraphQL */ `
      type Query {
        media: Media
      }

      union Media = Image | Video

      type Image {
        url: String
      }

      type Video {
        url: String
      }
    `,
    checkSdl: /* GraphQL */ `
      type Query {
        media: Media
      }

      union Media = Image

      type Image {
        url: String
      }
    `,
    expectedSchemaCheckTypename: {
      // should be breaking, because it changes the type of the field
      beforeReportedOperation: 'SchemaCheckError',
      // should be safe, because union member is not used
      afterReportedOperation: 'SchemaCheckSuccess',
    },
    reportOperation: {
      operation: 'query imageOnly { media { ... on Image { __typename url } } }',
      operationName: 'imageOnly',
      fields: 'auto-collect',
    },
  });

  testChangesWithUsageData({
    title: 'removing a used union member is a breaking change',
    publishSdl: /* GraphQL */ `
      type Query {
        media: Media
      }

      union Media = Image | Video

      type Image {
        url: String
      }

      type Video {
        url: String
      }
    `,
    checkSdl: /* GraphQL */ `
      type Query {
        media: Media
      }

      union Media = Image

      type Image {
        url: String
      }
    `,
    expectedSchemaCheckTypename: {
      // should be breaking, because it changes the type of the field
      beforeReportedOperation: 'SchemaCheckError',
      // should be breaking, because union member is used
      afterReportedOperation: 'SchemaCheckError',
    },
    reportOperation: {
      operation: 'query videoOnly { media { ... on Video { url } } }',
      operationName: 'videoOnly',
      fields: 'auto-collect',
    },
  });

  testChangesWithUsageData({
    title: 'removing a used union member is a breaking change (__typename)',
    publishSdl: /* GraphQL */ `
      type Query {
        media: Media
      }

      union Media = Image | Video

      type Image {
        url: String
      }

      type Video {
        url: String
      }
    `,
    checkSdl: /* GraphQL */ `
      type Query {
        media: Media
      }

      union Media = Image

      type Image {
        url: String
      }
    `,
    expectedSchemaCheckTypename: {
      // should be breaking, because it changes the type of the field
      beforeReportedOperation: 'SchemaCheckError',
      // should be breaking, because union member is referenced indirectly (__typename)
      afterReportedOperation: 'SchemaCheckError',
    },
    reportOperation: {
      operation: 'query videoOnly { media { __typename ... on Video { url } } }',
      operationName: 'videoOnly',
      fields: 'auto-collect',
    },
  });

  testChangesWithUsageData({
    title: 'removing a used enum value is a breaking change',
    publishSdl: /* GraphQL */ `
      type Query {
        feed: Post
      }

      enum Media {
        Image
        Video
      }

      type Post {
        id: ID!
        title: String!
        type: Media
      }
    `,
    checkSdl: /* GraphQL */ `
      type Query {
        feed: Post
      }

      enum Media {
        Image
      }

      type Post {
        id: ID!
        title: String!
        type: Media
      }
    `,
    expectedSchemaCheckTypename: {
      // Should be breaking,
      // because it will cause existing queries
      // that use this enum value to error
      beforeReportedOperation: 'SchemaCheckError',
      afterReportedOperation: 'SchemaCheckError',
    },
    reportOperation: {
      operation: 'query feed { feed { id type } }',
      operationName: 'feed',
      fields: 'auto-collect',
    },
  });

  testChangesWithUsageData({
    title: 'adding a new value to a used enum value is NOT a breaking change',
    publishSdl: /* GraphQL */ `
      type Query {
        feed: Post
      }

      enum Media {
        Image
        Video
      }

      type Post {
        id: ID!
        title: String!
        type: Media
      }
    `,
    checkSdl: /* GraphQL */ `
      type Query {
        feed: Post
      }

      enum Media {
        Image
        Video
        Audio
      }

      type Post {
        id: ID!
        title: String!
        type: Media
      }
    `,
    expectedSchemaCheckTypename: {
      beforeReportedOperation: 'SchemaCheckSuccess',
      afterReportedOperation: 'SchemaCheckSuccess',
    },
    reportOperation: {
      operation: 'query feed { feed { id type } }',
      operationName: 'feed',
      fields: 'auto-collect',
    },
  });
});

test.concurrent('number of produced and collected operations should match', async ({ expect }) => {
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

  await waitFor(10000);

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
  async ({ expect }) => {
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

    await waitFor(8000);

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
  async ({ expect }) => {
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

    await waitFor(8000);

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
  async ({ expect }) => {
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

    await waitFor(8000);

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

test.concurrent('ignore operations with syntax errors', async ({ expect }) => {
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

  await waitFor(8000);

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

test.concurrent('ensure correct data', async ({ expect }) => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject, organization } = await createOrg();
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

  // Organization was created, but the rate limiter may be not aware of it yet.
  await waitFor(6_000); // so the data retention is propagated to the rate-limiter

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

  await waitFor(8000);

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
      coordinates,
      timestamp,
      expires_at
    FROM operation_collection
    WHERE target = '${target.id}'
    GROUP BY target, hash, coordinates, name, body, operation_kind, timestamp, expires_at
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
  expect(
    differenceInDays(
      parseClickHouseDate(operationCollectionRow.expires_at),
      parseClickHouseDate(operationCollectionRow.timestamp),
    ),
  ).toBe(organization.rateLimit.retentionInDays);

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
  expect(
    differenceInDays(
      parseClickHouseDate(operationWithClient.expires_at),
      parseClickHouseDate(operationWithClient.timestamp),
    ),
  ).toBe(organization.rateLimit.retentionInDays);

  const operationWithoutClient = operationsResult.data.find(o => o.client_name.length === 0)!;
  expect(operationWithoutClient).toBeDefined();
  expect(operationWithoutClient.client_name).toHaveLength(0);
  expect(operationWithoutClient.client_version).toHaveLength(0);
  expect(ensureNumber(operationWithoutClient.duration)).toEqual(200_000_000);
  expect(ensureNumber(operationWithoutClient.errors)).toEqual(0);
  expect(operationWithoutClient.hash).toHaveLength(32);
  expect(operationWithoutClient.target).toEqual(target.id);
  expect(
    differenceInDays(
      parseClickHouseDate(operationWithoutClient.expires_at),
      parseClickHouseDate(operationWithoutClient.timestamp),
    ),
  ).toBe(organization.rateLimit.retentionInDays);

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
    timestamp: string;
    expires_at: string;
  }>(`
    SELECT
      target,
      sum(total) as total,
      sum(total_ok) as total_ok,
      hash,
      quantilesMerge(0.99)(duration_quantiles) as quantiles,
      timestamp,
      expires_at
    FROM operations_daily
    WHERE target = '${target.id}'
    GROUP BY target, hash, timestamp, expires_at
  `);

  expect(operationsDailyResult.data).toHaveLength(1);

  const dailyAgg = operationsDailyResult.data[0];
  expect(dailyAgg).toBeDefined();
  expect(ensureNumber(dailyAgg.quantiles[0])).toEqual(200_000_000);
  expect(ensureNumber(dailyAgg.total)).toEqual(2);
  expect(ensureNumber(dailyAgg.total_ok)).toEqual(2);
  expect(dailyAgg.hash).toHaveLength(32);
  expect(dailyAgg.target).toEqual(target.id);
  expect(
    differenceInDays(
      parseClickHouseDate(dailyAgg.expires_at),
      parseClickHouseDate(dailyAgg.timestamp),
    ),
  ).toBe(organization.rateLimit.retentionInDays);

  // coordinates_daily
  const coordinatesDailyResult = await clickHouseQuery<{
    target: string;
    hash: string;
    total: string;
    coordinate: string;
    timestamp: string;
    expires_at: string;
  }>(`
    SELECT
      target,
      sum(total) as total,
      hash,
      coordinate,
      timestamp,
      expires_at
    FROM coordinates_daily
    WHERE target = '${target.id}'
    GROUP BY target, hash, coordinate, timestamp, expires_at
  `);

  expect(coordinatesDailyResult.data).toHaveLength(2);

  const rootCoordinate = coordinatesDailyResult.data.find(c => c.coordinate === 'Query')!;
  expect(rootCoordinate).toBeDefined();
  expect(ensureNumber(rootCoordinate.total)).toEqual(2);
  expect(rootCoordinate.hash).toHaveLength(32);
  expect(rootCoordinate.target).toEqual(target.id);
  expect(
    differenceInDays(
      parseClickHouseDate(rootCoordinate.expires_at),
      parseClickHouseDate(rootCoordinate.timestamp),
    ),
  ).toBe(organization.rateLimit.retentionInDays);

  const fieldCoordinate = coordinatesDailyResult.data.find(c => c.coordinate === 'Query.ping')!;
  expect(fieldCoordinate).toBeDefined();
  expect(ensureNumber(fieldCoordinate.total)).toEqual(2);
  expect(fieldCoordinate.hash).toHaveLength(32);
  expect(fieldCoordinate.target).toEqual(target.id);
  expect(
    differenceInDays(
      parseClickHouseDate(fieldCoordinate.expires_at),
      parseClickHouseDate(fieldCoordinate.timestamp),
    ),
  ).toBe(organization.rateLimit.retentionInDays);

  // clients_daily
  const clientsDailyResult = await clickHouseQuery<{
    target: string;
    hash: string;
    client_name: string;
    client_version: string;
    total: string;
    timestamp: string;
    expires_at: string;
  }>(`
    SELECT
      target,
      sum(total) as total,
      hash,
      client_name,
      client_version,
      timestamp,
      expires_at
    FROM clients_daily
    WHERE target = '${target.id}'
    GROUP BY target, hash, client_name, client_version, timestamp, expires_at
  `);

  expect(clientsDailyResult.data).toHaveLength(2);

  const dailyAggOfKnownClient = clientsDailyResult.data.find(c => c.client_name === 'test-name')!;
  expect(dailyAggOfKnownClient).toBeDefined();
  expect(ensureNumber(dailyAggOfKnownClient.total)).toEqual(1);
  expect(dailyAggOfKnownClient.client_version).toBe('test-version');
  expect(dailyAggOfKnownClient.hash).toHaveLength(32);
  expect(dailyAggOfKnownClient.target).toEqual(target.id);
  expect(
    differenceInDays(
      parseClickHouseDate(dailyAggOfKnownClient.expires_at),
      parseClickHouseDate(dailyAggOfKnownClient.timestamp),
    ),
  ).toBe(organization.rateLimit.retentionInDays);

  const dailyAggOfUnknownClient = clientsDailyResult.data.find(c => c.client_name !== 'test-name')!;
  expect(dailyAggOfUnknownClient).toBeDefined();
  expect(ensureNumber(dailyAggOfUnknownClient.total)).toEqual(1);
  expect(dailyAggOfUnknownClient.client_version).toHaveLength(0);
  expect(dailyAggOfUnknownClient.hash).toHaveLength(32);
  expect(dailyAggOfUnknownClient.target).toEqual(target.id);
  expect(
    differenceInDays(
      parseClickHouseDate(dailyAggOfUnknownClient.expires_at),
      parseClickHouseDate(dailyAggOfUnknownClient.timestamp),
    ),
  ).toBe(organization.rateLimit.retentionInDays);
});

test.concurrent(
  'ensure correct data when data retention period is non-default',
  async ({ expect }) => {
    const { createOrg } = await initSeed().createOwner();
    const { createProject, setDataRetention } = await createOrg();
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

    const dataRetentionInDays = 60;
    await setDataRetention(dataRetentionInDays);
    await waitFor(10_000); // so the data retention is propagated to the rate-limiter

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

    await waitFor(8000);

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
      coordinates,
      timestamp,
      expires_at
    FROM operation_collection
    WHERE target = '${target.id}'
    GROUP BY target, hash, coordinates, name, body, operation_kind, timestamp, expires_at
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
    expect(
      differenceInDays(
        parseClickHouseDate(operationCollectionRow.expires_at),
        parseClickHouseDate(operationCollectionRow.timestamp),
      ),
    ).toBe(dataRetentionInDays);

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
    expect(
      differenceInDays(
        parseClickHouseDate(operationWithClient.expires_at),
        parseClickHouseDate(operationWithClient.timestamp),
      ),
    ).toBe(dataRetentionInDays);

    const operationWithoutClient = operationsResult.data.find(o => o.client_name.length === 0)!;
    expect(operationWithoutClient).toBeDefined();
    expect(operationWithoutClient.client_name).toHaveLength(0);
    expect(operationWithoutClient.client_version).toHaveLength(0);
    expect(ensureNumber(operationWithoutClient.duration)).toEqual(200_000_000);
    expect(ensureNumber(operationWithoutClient.errors)).toEqual(0);
    expect(operationWithoutClient.hash).toHaveLength(32);
    expect(operationWithoutClient.target).toEqual(target.id);
    expect(
      differenceInDays(
        parseClickHouseDate(operationWithoutClient.expires_at),
        parseClickHouseDate(operationWithoutClient.timestamp),
      ),
    ).toBe(dataRetentionInDays);

    await waitFor(3000);
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
      timestamp: string;
      expires_at: string;
      hash: string;
      total_ok: string;
      total: string;
      quantiles: [number];
    }>(`
    SELECT
      target,
      timestamp,
      expires_at,
      sum(total) as total,
      sum(total_ok) as total_ok,
      hash,
      quantilesMerge(0.99)(duration_quantiles) as quantiles
    FROM operations_daily
    WHERE target = '${target.id}'
    GROUP BY target, hash, timestamp, expires_at
  `);

    expect(operationsDailyResult.data).toHaveLength(1);

    const dailyAgg = operationsDailyResult.data[0];
    expect(dailyAgg).toBeDefined();
    expect(ensureNumber(dailyAgg.quantiles[0])).toEqual(200_000_000);
    expect(ensureNumber(dailyAgg.total)).toEqual(2);
    expect(ensureNumber(dailyAgg.total_ok)).toEqual(2);
    expect(dailyAgg.hash).toHaveLength(32);
    expect(dailyAgg.target).toEqual(target.id);
    expect(
      differenceInDays(
        parseClickHouseDate(dailyAgg.expires_at),
        parseClickHouseDate(dailyAgg.timestamp),
      ),
    ).toBe(dataRetentionInDays);

    // coordinates_daily
    const coordinatesDailyResult = await clickHouseQuery<{
      target: string;
      hash: string;
      total: string;
      coordinate: string;
      timestamp: string;
      expires_at: string;
    }>(`
    SELECT
      target,
      sum(total) as total,
      hash,
      coordinate,
      timestamp,
      expires_at
    FROM coordinates_daily
    WHERE target = '${target.id}'
    GROUP BY target, hash, coordinate, timestamp, expires_at
  `);

    expect(coordinatesDailyResult.data).toHaveLength(2);

    const rootCoordinate = coordinatesDailyResult.data.find(c => c.coordinate === 'Query')!;
    expect(rootCoordinate).toBeDefined();
    expect(ensureNumber(rootCoordinate.total)).toEqual(2);
    expect(rootCoordinate.hash).toHaveLength(32);
    expect(rootCoordinate.target).toEqual(target.id);
    expect(
      differenceInDays(
        parseClickHouseDate(rootCoordinate.expires_at),
        parseClickHouseDate(rootCoordinate.timestamp),
      ),
    ).toBe(dataRetentionInDays);

    const fieldCoordinate = coordinatesDailyResult.data.find(c => c.coordinate === 'Query.ping')!;
    expect(fieldCoordinate).toBeDefined();
    expect(ensureNumber(fieldCoordinate.total)).toEqual(2);
    expect(fieldCoordinate.hash).toHaveLength(32);
    expect(fieldCoordinate.target).toEqual(target.id);
    expect(
      differenceInDays(
        parseClickHouseDate(fieldCoordinate.expires_at),
        parseClickHouseDate(fieldCoordinate.timestamp),
      ),
    ).toBe(dataRetentionInDays);

    // clients_daily
    const clientsDailyResult = await clickHouseQuery<{
      target: string;
      hash: string;
      client_name: string;
      client_version: string;
      total: string;
      timestamp: string;
      expires_at: string;
    }>(`
    SELECT
      target,
      sum(total) as total,
      hash,
      client_name,
      client_version,
      timestamp,
      expires_at
    FROM clients_daily
    WHERE target = '${target.id}'
    GROUP BY target, hash, client_name, client_version, timestamp, expires_at
  `);

    expect(clientsDailyResult.data).toHaveLength(2);

    const dailyAggOfKnownClient = clientsDailyResult.data.find(c => c.client_name === 'test-name')!;
    expect(dailyAggOfKnownClient).toBeDefined();
    expect(ensureNumber(dailyAggOfKnownClient.total)).toEqual(1);
    expect(dailyAggOfKnownClient.client_version).toBe('test-version');
    expect(dailyAggOfKnownClient.hash).toHaveLength(32);
    expect(dailyAggOfKnownClient.target).toEqual(target.id);
    expect(
      differenceInDays(
        parseClickHouseDate(dailyAggOfKnownClient.expires_at),
        parseClickHouseDate(dailyAggOfKnownClient.timestamp),
      ),
    ).toBe(dataRetentionInDays);

    const dailyAggOfUnknownClient = clientsDailyResult.data.find(
      c => c.client_name !== 'test-name',
    )!;
    expect(dailyAggOfUnknownClient).toBeDefined();
    expect(ensureNumber(dailyAggOfUnknownClient.total)).toEqual(1);
    expect(dailyAggOfUnknownClient.client_version).toHaveLength(0);
    expect(dailyAggOfUnknownClient.hash).toHaveLength(32);
    expect(dailyAggOfUnknownClient.target).toEqual(target.id);
    expect(
      differenceInDays(
        parseClickHouseDate(dailyAggOfUnknownClient.expires_at),
        parseClickHouseDate(dailyAggOfUnknownClient.timestamp),
      ),
    ).toBe(dataRetentionInDays);
  },
);

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
  'test threshold when using conditional breaking change detection',
  async ({ expect }) => {
    const { createOrg } = await initSeed().createOwner();
    const { createProject } = await createOrg();
    const { createToken } = await createProject(ProjectType.Single);
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
        c: String
      }
    `;

    const queryA = parse(/* GraphQL */ `
      query {
        a
      }
    `);
    const queryB = parse(/* GraphQL */ `
      query {
        b
      }
    `);

    function collectA() {
      client.collectUsage()(
        {
          document: queryA,
          schema,
          contextValue: {
            request,
          },
        },
        {},
      );
    }

    function collectB() {
      client.collectUsage()(
        {
          document: queryB,
          schema,
          contextValue: {
            request,
          },
        },
        {},
      );
    }

    const schema = buildASTSchema(parse(sdl));

    const schemaPublishResult = await token
      .publishSchema({
        sdl,
        author: 'Kamil',
        commit: 'initial',
      })
      .then(res => res.expectNoGraphQLErrors());

    expect(schemaPublishResult.schemaPublish.__typename).toEqual('SchemaPublishSuccess');

    await token.toggleTargetValidation(true);

    const unused = await token
      .checkSchema(/* GraphQL */ `
        type Query {
          b: String
          c: String
        }
      `)
      .then(r => r.expectNoGraphQLErrors());

    if (unused.schemaCheck.__typename !== 'SchemaCheckSuccess') {
      throw new Error(`Expected SchemaCheckSuccess, got ${unused.schemaCheck.__typename}`);
    }

    expect(unused.schemaCheck.changes).toEqual(
      expect.objectContaining({
        nodes: expect.arrayContaining([
          expect.objectContaining({
            message: "Field 'a' was removed from object type 'Query' (non-breaking based on usage)",
          }),
        ]),
        total: 1,
      }),
    );

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

    collectA();

    await waitFor(8000);

    const used = await token
      .checkSchema(/* GraphQL */ `
        type Query {
          b: String
          c: String
        }
      `)
      .then(r => r.expectNoGraphQLErrors());

    if (used.schemaCheck.__typename !== 'SchemaCheckError') {
      throw new Error(`Expected SchemaCheckError, got ${used.schemaCheck.__typename}`);
    }

    expect(used.schemaCheck.errors).toEqual({
      nodes: [
        {
          message: "Field 'a' was removed from object type 'Query'",
        },
      ],
      total: 1,
    });

    // Now let's make Query.a below threshold by making 3 queries for Query.b

    collectB();
    collectB();
    collectB();

    await token.updateTargetValidationSettings({
      excludedClients: [],
      percentage: 50,
    });

    await waitFor(8000);

    const below = await token
      .checkSchema(/* GraphQL */ `
        type Query {
          b: String
          c: String
        }
      `)
      .then(r => r.expectNoGraphQLErrors());

    if (below.schemaCheck.__typename !== 'SchemaCheckSuccess') {
      throw new Error(`Expected SchemaCheckSuccess, got ${below.schemaCheck.__typename}`);
    }

    expect(below.schemaCheck.changes).toEqual(
      expect.objectContaining({
        nodes: expect.arrayContaining([
          expect.objectContaining({
            message: "Field 'a' was removed from object type 'Query' (non-breaking based on usage)",
          }),
        ]),
        total: 1,
      }),
    );

    // Make it above threshold again, by making 3 queries for Query.a

    collectA();
    collectA();
    collectA();

    await waitFor(8000);

    const relevant = await token
      .checkSchema(/* GraphQL */ `
        type Query {
          b: String
          c: String
        }
      `)
      .then(r => r.expectNoGraphQLErrors());

    if (relevant.schemaCheck.__typename !== 'SchemaCheckError') {
      throw new Error(`Expected SchemaCheckError, got ${relevant.schemaCheck.__typename}`);
    }

    expect(relevant.schemaCheck.errors).toEqual({
      nodes: [
        {
          message: "Field 'a' was removed from object type 'Query'",
        },
      ],
      total: 1,
    });
  },
);

test.concurrent(
  'subscription operation is used for conditional breaking change detection',
  async ({ expect }) => {
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

    const schema = buildASTSchema(parse(sdl));

    const schemaPublishResult = await token
      .publishSchema({
        sdl,
        author: 'Kamil',
        commit: 'initial',
      })
      .then(res => res.expectNoGraphQLErrors());

    expect(schemaPublishResult.schemaPublish.__typename).toEqual('SchemaPublishSuccess');

    await token.toggleTargetValidation(true);

    const unused = await token
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

    if (unused.schemaCheck.__typename !== 'SchemaCheckSuccess') {
      throw new Error(`Expected SchemaCheckSuccess, got ${unused.schemaCheck.__typename}`);
    }

    expect(unused.schemaCheck.changes).toEqual(
      expect.objectContaining({
        nodes: expect.arrayContaining([
          expect.objectContaining({
            message:
              "Field 'a' was removed from object type 'Subscription' (non-breaking based on usage)",
          }),
        ]),
        total: 1,
      }),
    );

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
        schema,
        contextValue: {
          request,
        },
      },
    });

    await waitFor(10000);

    const used = await token
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

    if (used.schemaCheck.__typename !== 'SchemaCheckError') {
      throw new Error(`Expected SchemaCheckError, got ${used.schemaCheck.__typename}`);
    }

    expect(used.schemaCheck.errors).toEqual({
      nodes: [
        {
          message: "Field 'a' was removed from object type 'Subscription'",
        },
      ],
      total: 1,
    });

    const firstSchemaCheckId = used.schemaCheck.schemaCheck?.id;

    if (!firstSchemaCheckId) {
      throw new Error('Expected schemaCheckId to be defined');
    }

    const firstSchemaCheck = await execute({
      document: SubscriptionSchemaCheckQuery,
      variables: {
        id: firstSchemaCheckId,
        selector: {
          organizationSlug: organization.slug,
          projectSlug: project.slug,
          targetSlug: target.slug,
        },
      },
      authToken: token.secret,
    }).then(r => r.expectNoGraphQLErrors());

    const node = firstSchemaCheck.target?.schemaCheck?.breakingSchemaChanges?.nodes[0];

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

    // Now let's make subscription insignificant by making 3 queries

    client.collectUsage()(
      {
        document: parse(/* GraphQL */ `
          query {
            a
          }
        `),
        schema,
        contextValue: {
          request,
        },
      },
      {},
    );
    client.collectUsage()(
      {
        document: parse(/* GraphQL */ `
          query {
            a
          }
        `),
        schema,
        contextValue: {
          request,
        },
      },
      {},
    );
    client.collectUsage()(
      {
        document: parse(/* GraphQL */ `
          query {
            a
          }
        `),
        schema,
        contextValue: {
          request,
        },
      },
      {},
    );

    await token.updateTargetValidationSettings({
      excludedClients: [],
      percentage: 50,
    });

    await waitFor(8000);

    const irrelevant = await token
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

    if (irrelevant.schemaCheck.__typename !== 'SchemaCheckSuccess') {
      throw new Error(`Expected SchemaCheckSuccess, got ${irrelevant.schemaCheck.__typename}`);
    }

    expect(irrelevant.schemaCheck.changes).toEqual(
      expect.objectContaining({
        nodes: expect.arrayContaining([
          expect.objectContaining({
            message:
              "Field 'a' was removed from object type 'Subscription' (non-breaking based on usage)",
          }),
        ]),
        total: 1,
      }),
    );

    // Make it relevant again, by making 3 subscriptions

    client.collectSubscriptionUsage({
      args: {
        document: parse(/* GraphQL */ `
          subscription {
            a
          }
        `),
        schema,
        contextValue: {
          request,
        },
      },
    });
    client.collectSubscriptionUsage({
      args: {
        document: parse(/* GraphQL */ `
          subscription {
            a
          }
        `),
        schema,
        contextValue: {
          request,
        },
      },
    });
    client.collectSubscriptionUsage({
      args: {
        document: parse(/* GraphQL */ `
          subscription {
            a
          }
        `),
        schema,
        contextValue: {
          request,
        },
      },
    });

    await waitFor(8000);

    const relevant = await token
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

    if (relevant.schemaCheck.__typename !== 'SchemaCheckError') {
      throw new Error(`Expected SchemaCheckError, got ${relevant.schemaCheck.__typename}`);
    }

    expect(relevant.schemaCheck.errors).toEqual({
      nodes: [
        {
          message: "Field 'a' was removed from object type 'Subscription'",
        },
      ],
      total: 1,
    });
  },
);

test.concurrent('ensure percentage precision up to 2 decimal places', async ({ expect }) => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject, organization } = await createOrg();
  const { project, target, createToken } = await createProject(ProjectType.Single);
  const token = await createToken({
    targetScopes: [
      TargetAccessScope.Read,
      TargetAccessScope.Settings,
      TargetAccessScope.RegistryRead,
      TargetAccessScope.RegistryWrite,
    ],
    projectScopes: [ProjectAccessScope.Read],
    organizationScopes: [OrganizationAccessScope.Read],
  });

  const schemaPublishResult = await token
    .publishSchema({
      author: 'Kamil',
      commit: 'abc123',
      sdl: `type Query { ping: String pong: String }`,
    })
    .then(r => r.expectNoGraphQLErrors());

  expect((schemaPublishResult.schemaPublish as any).valid).toEqual(true);

  await token.collectLegacyOperations(
    prepareBatch(9801, {
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
  await token.collectLegacyOperations(
    prepareBatch(199, {
      operation: 'query pong { pong }',
      operationName: 'pong',
      fields: ['Query', 'Query.pong'],
      execution: {
        ok: true,
        duration: 100_000_000,
        errorsTotal: 0,
      },
    }),
  );

  await waitFor(10000);

  const result = await clickHouseQuery<{
    target: string;
    client_name: string | null;
    hash: string;
    total: number;
  }>(`
    SELECT
      target, sum(total) as total
    FROM clients_daily
    WHERE
      timestamp >= subtractDays(now(), 30)
      AND timestamp <= now()
      AND target = '${target.id}'
    GROUP BY target
  `);

  expect(result.rows).toEqual(1);
  expect(result.data).toContainEqual(
    expect.objectContaining({
      target: target.id,
      total: expect.stringMatching('10000'),
    }),
  );

  const targetValidationResult = await token.toggleTargetValidation(true);
  expect(targetValidationResult.setTargetValidation.validationSettings.enabled).toEqual(true);

  // should accept a breaking change when percentage is 2%
  let updateValidationResult = await updateTargetValidationSettings(
    {
      organizationSlug: organization.slug,
      projectSlug: project.slug,
      targetSlug: target.slug,
      percentage: 2,
      period: 2,
      targetIds: [target.id],
      excludedClients: [],
    },
    {
      token: token.secret,
    },
  ).then(r => r.expectNoGraphQLErrors());

  expect(
    updateValidationResult.updateTargetValidationSettings.ok?.target.validationSettings.enabled,
  ).toBe(true);
  expect(
    updateValidationResult.updateTargetValidationSettings.ok?.target.validationSettings.percentage,
  ).toBe(2);

  const unusedCheckResult2 = await token
    .checkSchema(`type Query { ping: String }`)
    .then(r => r.expectNoGraphQLErrors());
  expect(unusedCheckResult2.schemaCheck.__typename).toEqual('SchemaCheckSuccess');

  // should reject a breaking change when percentage is 1.99%
  updateValidationResult = await updateTargetValidationSettings(
    {
      organizationSlug: organization.slug,
      projectSlug: project.slug,
      targetSlug: target.slug,
      percentage: 1.99,
      period: 2,
      targetIds: [target.id],
      excludedClients: [],
    },
    {
      token: token.secret,
    },
  ).then(r => r.expectNoGraphQLErrors());

  expect(
    updateValidationResult.updateTargetValidationSettings.ok?.target.validationSettings.enabled,
  ).toBe(true);
  expect(
    updateValidationResult.updateTargetValidationSettings.ok?.target.validationSettings.percentage,
  ).toBe(1.99);

  const unusedCheckResult199 = await token
    .checkSchema(`type Query { ping: String }`)
    .then(r => r.expectNoGraphQLErrors());
  expect(unusedCheckResult199.schemaCheck.__typename).toEqual('SchemaCheckError');
});
