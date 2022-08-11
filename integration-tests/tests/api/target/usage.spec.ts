import { TargetAccessScope, ProjectType, ProjectAccessScope, OrganizationAccessScope } from '@app/gql/graphql';
import formatISO from 'date-fns/formatISO';
import subHours from 'date-fns/subHours';
import {
  createOrganization,
  createProject,
  createTarget,
  createToken,
  publishSchema,
  checkSchema,
  setTargetValidation,
  updateTargetValidationSettings,
  readOperationsStats,
  waitFor,
} from '../../../testkit/flow';
import { authenticate } from '../../../testkit/auth';
import { collect, CollectedOperation } from '../../../testkit/usage';
import { clickHouseQuery } from '../../../testkit/clickhouse';
// eslint-disable-next-line hive/enforce-deps-in-dev, import/no-extraneous-dependencies
import { normalizeOperation } from '@graphql-hive/core';
// eslint-disable-next-line import/no-extraneous-dependencies
import { parse, print } from 'graphql';

function sendBatch(amount: number, operation: CollectedOperation, token: string) {
  return collect({
    operations: new Array(amount).fill(operation),
    token,
  });
}

test('collect operation', async () => {
  const { access_token: owner_access_token } = await authenticate('main');
  const orgResult = await createOrganization(
    {
      name: 'foo',
    },
    owner_access_token
  );

  const org = orgResult.body.data!.createOrganization.ok!.createdOrganizationPayload.organization;

  const projectResult = await createProject(
    {
      organization: org.cleanId,
      type: ProjectType.Single,
      name: 'foo',
    },
    owner_access_token
  );

  const project = projectResult.body.data!.createProject.ok!.createdProject;
  const target = projectResult.body.data!.createProject.ok!.createdTargets[0];

  const settingsTokenResult = await createToken(
    {
      name: 'test-settings',
      organization: org.cleanId,
      project: project.cleanId,
      target: target.cleanId,
      organizationScopes: [OrganizationAccessScope.Read],
      projectScopes: [ProjectAccessScope.Read],
      targetScopes: [TargetAccessScope.Read, TargetAccessScope.Settings],
    },
    owner_access_token
  );

  const tokenResult = await createToken(
    {
      name: 'test',
      organization: org.cleanId,
      project: project.cleanId,
      target: target.cleanId,
      organizationScopes: [OrganizationAccessScope.Read],
      projectScopes: [ProjectAccessScope.Read],
      targetScopes: [TargetAccessScope.Read, TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
    },
    owner_access_token
  );

  expect(settingsTokenResult.body.errors).not.toBeDefined();
  expect(tokenResult.body.errors).not.toBeDefined();

  const token = tokenResult.body.data!.createToken.ok!.secret;
  const tokenForSettings = settingsTokenResult.body.data!.createToken.ok!.secret;

  const schemaPublishResult = await publishSchema(
    {
      author: 'Kamil',
      commit: 'abc123',
      sdl: `type Query { ping: String me: String }`,
    },
    token
  );

  expect(schemaPublishResult.body.errors).not.toBeDefined();
  expect((schemaPublishResult.body.data!.schemaPublish as any).valid).toEqual(true);

  const targetValidationResult = await setTargetValidation(
    {
      enabled: true,
      organization: org.cleanId,
      project: project.cleanId,
      target: target.cleanId,
    },
    {
      token: tokenForSettings,
    }
  );

  expect(targetValidationResult.body.errors).not.toBeDefined();
  expect(targetValidationResult.body.data!.setTargetValidation.enabled).toEqual(true);
  expect(targetValidationResult.body.data!.setTargetValidation.percentage).toEqual(0);
  expect(targetValidationResult.body.data!.setTargetValidation.period).toEqual(30);

  // should not be breaking because the field is unused
  const unusedCheckResult = await checkSchema(
    {
      sdl: `type Query { me: String }`,
    },
    token
  );
  expect(unusedCheckResult.body.errors).not.toBeDefined();
  expect(unusedCheckResult.body.data!.schemaCheck.__typename).toEqual('SchemaCheckSuccess');

  const collectResult = await collect({
    operations: [
      {
        operation: 'query ping { ping }',
        operationName: 'ping',
        fields: ['Query', 'Query.ping'],
        execution: {
          ok: true,
          duration: 200000000,
          errorsTotal: 0,
        },
      },
    ],
    token,
  });

  expect(collectResult.status).toEqual(200);

  await waitFor(5_000);

  // should be breaking because the field is used now
  const usedCheckResult = await checkSchema(
    {
      sdl: `type Query { me: String }`,
    },
    token
  );

  if (usedCheckResult.body.data!.schemaCheck.__typename !== 'SchemaCheckError') {
    throw new Error(`Expected SchemaCheckError, got ${usedCheckResult.body.data!.schemaCheck.__typename}`);
  }

  expect(usedCheckResult.body.data!.schemaCheck.valid).toEqual(false);

  const from = formatISO(subHours(Date.now(), 6));
  const to = formatISO(Date.now());
  const operationStatsResult = await readOperationsStats(
    {
      organization: org.cleanId,
      project: project.cleanId,
      target: target.cleanId,
      period: {
        from,
        to,
      },
    },
    token
  );

  expect(operationStatsResult.body.errors).not.toBeDefined();

  const operationsStats = operationStatsResult.body.data!.operationsStats;

  expect(operationsStats.operations.nodes).toHaveLength(1);

  const op = operationsStats.operations.nodes[0];

  expect(op.count).toEqual(1);
  expect(op.document).toMatch('ping');
  expect(op.operationHash).toBeDefined();
  expect(op.duration.p75).toEqual(200);
  expect(op.duration.p90).toEqual(200);
  expect(op.duration.p95).toEqual(200);
  expect(op.duration.p99).toEqual(200);
  expect(op.kind).toEqual('query');
  expect(op.name).toMatch('ping');
  expect(op.percentage).toBeGreaterThan(99);
});

test('normalize and collect operation without breaking its syntax', async () => {
  const { access_token: owner_access_token } = await authenticate('main');
  const orgResult = await createOrganization(
    {
      name: 'foo',
    },
    owner_access_token
  );

  const org = orgResult.body.data!.createOrganization.ok!.createdOrganizationPayload.organization;

  const projectResult = await createProject(
    {
      organization: org.cleanId,
      type: ProjectType.Single,
      name: 'foo',
    },
    owner_access_token
  );

  const project = projectResult.body.data!.createProject.ok!.createdProject;
  const target = projectResult.body.data!.createProject.ok!.createdTargets[0];

  const settingsTokenResult = await createToken(
    {
      name: 'test-settings',
      organization: org.cleanId,
      project: project.cleanId,
      target: target.cleanId,
      organizationScopes: [OrganizationAccessScope.Read],
      projectScopes: [ProjectAccessScope.Read],
      targetScopes: [TargetAccessScope.Read, TargetAccessScope.Settings],
    },
    owner_access_token
  );

  const tokenResult = await createToken(
    {
      name: 'test',
      organization: org.cleanId,
      project: project.cleanId,
      target: target.cleanId,
      organizationScopes: [OrganizationAccessScope.Read],
      projectScopes: [ProjectAccessScope.Read],
      targetScopes: [TargetAccessScope.Read, TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
    },
    owner_access_token
  );

  expect(settingsTokenResult.body.errors).not.toBeDefined();
  expect(tokenResult.body.errors).not.toBeDefined();

  const token = tokenResult.body.data!.createToken.ok!.secret;

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

  const collectResult = await collect({
    operations: [
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
          duration: 200000000,
          errorsTotal: 0,
        },
      },
    ],
    token,
  });

  expect(collectResult.status).toEqual(200);

  await waitFor(5_000);

  const from = formatISO(subHours(Date.now(), 6));
  const to = formatISO(Date.now());
  const operationStatsResult = await readOperationsStats(
    {
      organization: org.cleanId,
      project: project.cleanId,
      target: target.cleanId,
      period: {
        from,
        to,
      },
    },
    token
  );

  expect(operationStatsResult.body.errors).not.toBeDefined();

  const operationsStats = operationStatsResult.body.data!.operationsStats;

  expect(operationsStats.operations.nodes).toHaveLength(1);

  const op = operationsStats.operations.nodes[0];

  expect(op.count).toEqual(1);
  expect(() => {
    parse(op.document);
  }).not.toThrow();
  expect(print(parse(op.document))).toEqual(print(parse(normalized_document)));
  expect(op.operationHash).toBeDefined();
  expect(op.duration.p75).toEqual(200);
  expect(op.duration.p90).toEqual(200);
  expect(op.duration.p95).toEqual(200);
  expect(op.duration.p99).toEqual(200);
  expect(op.kind).toEqual('query');
  expect(op.name).toMatch('outfit');
  expect(op.percentage).toBeGreaterThan(99);
});

test('number of produced and collected operations should match (no errors)', async () => {
  const { access_token: owner_access_token } = await authenticate('main');
  const orgResult = await createOrganization(
    {
      name: 'foo',
    },
    owner_access_token
  );

  const org = orgResult.body.data!.createOrganization.ok!.createdOrganizationPayload.organization;

  const projectResult = await createProject(
    {
      organization: org.cleanId,
      type: ProjectType.Single,
      name: 'foo',
    },
    owner_access_token
  );

  const project = projectResult.body.data!.createProject.ok!.createdProject;
  const target = projectResult.body.data!.createProject.ok!.createdTargets[0];

  const tokenResult = await createToken(
    {
      name: 'test',
      organization: org.cleanId,
      project: project.cleanId,
      target: target.cleanId,
      organizationScopes: [OrganizationAccessScope.Read],
      projectScopes: [ProjectAccessScope.Read],
      targetScopes: [TargetAccessScope.Read, TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
    },
    owner_access_token
  );

  expect(tokenResult.body.errors).not.toBeDefined();

  const token = tokenResult.body.data!.createToken.ok!.secret;

  const batchSize = 1000;
  const totalAmount = 10_000;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  for await (const _ of new Array(totalAmount / batchSize)) {
    await sendBatch(
      batchSize,
      {
        operation: 'query ping { ping }',
        operationName: 'ping',
        fields: ['Query', 'Query.ping'],
        execution: {
          ok: true,
          duration: 200000000,
          errorsTotal: 0,
        },
      },
      token
    );
  }

  await waitFor(5_000);

  const from = formatISO(subHours(Date.now(), 6));
  const to = formatISO(Date.now());
  const operationStatsResult = await readOperationsStats(
    {
      organization: org.cleanId,
      project: project.cleanId,
      target: target.cleanId,
      period: {
        from,
        to,
      },
    },
    token
  );

  expect(operationStatsResult.body.errors).not.toBeDefined();

  const operationsStats = operationStatsResult.body.data!.operationsStats;

  // We sent a single operation (multiple times)
  expect(operationsStats.operations.nodes).toHaveLength(1);

  const op = operationsStats.operations.nodes[0];

  expect(op.count).toEqual(totalAmount);
  expect(op.document).toMatch('ping');
  expect(op.operationHash).toBeDefined();
  expect(op.duration.p75).toEqual(200);
  expect(op.duration.p90).toEqual(200);
  expect(op.duration.p95).toEqual(200);
  expect(op.duration.p99).toEqual(200);
  expect(op.kind).toEqual('query');
  expect(op.name).toMatch('ping');
  expect(op.percentage).toBeGreaterThan(99);
});

test('check usage from two selected targets', async () => {
  const { access_token: owner_access_token } = await authenticate('main');
  const orgResult = await createOrganization(
    {
      name: 'foo',
    },
    owner_access_token
  );

  const org = orgResult.body.data!.createOrganization.ok!.createdOrganizationPayload.organization;

  const projectResult = await createProject(
    {
      organization: org.cleanId,
      type: ProjectType.Single,
      name: 'foo',
    },
    owner_access_token
  );

  const project = projectResult.body.data!.createProject.ok!.createdProject;
  const staging = projectResult.body.data!.createProject.ok!.createdTargets[0];

  const productionTargetResult = await createTarget(
    {
      name: 'production',
      organization: org.cleanId,
      project: project.cleanId,
    },
    owner_access_token
  );

  const production = productionTargetResult.body.data!.createTarget.ok!.createdTarget;

  const stagingTokenResult = await createToken(
    {
      name: 'test',
      organization: org.cleanId,
      project: project.cleanId,
      target: staging.cleanId,
      organizationScopes: [OrganizationAccessScope.Read],
      projectScopes: [ProjectAccessScope.Read],
      targetScopes: [TargetAccessScope.Read, TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
    },
    owner_access_token
  );

  const productionTokenResult = await createToken(
    {
      name: 'test',
      organization: org.cleanId,
      project: project.cleanId,
      target: production.cleanId,
      organizationScopes: [OrganizationAccessScope.Read],
      projectScopes: [ProjectAccessScope.Read],
      targetScopes: [TargetAccessScope.Read, TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
    },
    owner_access_token
  );

  expect(stagingTokenResult.body.errors).not.toBeDefined();
  expect(productionTokenResult.body.errors).not.toBeDefined();

  const tokenForStaging = stagingTokenResult.body.data!.createToken.ok!.secret;
  const tokenForProduction = productionTokenResult.body.data!.createToken.ok!.secret;

  const schemaPublishResult = await publishSchema(
    {
      author: 'Kamil',
      commit: 'usage-check-2',
      sdl: `type Query { ping: String me: String }`,
    },
    tokenForStaging
  );

  expect(schemaPublishResult.body.errors).not.toBeDefined();
  expect((schemaPublishResult.body.data!.schemaPublish as any).valid).toEqual(true);

  const targetValidationResult = await setTargetValidation(
    {
      enabled: true,
      organization: org.cleanId,
      project: project.cleanId,
      target: staging.cleanId,
    },
    {
      authToken: owner_access_token,
    }
  );

  expect(targetValidationResult.body.errors).not.toBeDefined();
  expect(targetValidationResult.body.data!.setTargetValidation.enabled).toEqual(true);
  expect(targetValidationResult.body.data!.setTargetValidation.percentage).toEqual(0);
  expect(targetValidationResult.body.data!.setTargetValidation.period).toEqual(30);

  const collectResult = await collect({
    operations: [
      {
        timestamp: Date.now(),
        operation: 'query ping { ping }',
        operationName: 'ping',
        fields: ['Query', 'Query.ping'],
        execution: {
          ok: true,
          duration: 200000000,
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
          duration: 200000000,
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
          duration: 200000000,
          errorsTotal: 0,
        },
      },
    ],
    token: tokenForProduction, // put collected operation in production
  });

  expect(collectResult.status).toEqual(200);

  await waitFor(22_000);

  // should not be breaking because the field is unused on staging
  const unusedCheckResult = await checkSchema(
    {
      sdl: `type Query { me: String }`, // ping is used but on production
    },
    tokenForStaging
  );
  expect(unusedCheckResult.body.errors).not.toBeDefined();
  expect(unusedCheckResult.body.data!.schemaCheck.__typename).toEqual('SchemaCheckSuccess');

  // Now switch to using checking both staging and production

  const updateValidationResult = await updateTargetValidationSettings(
    {
      organization: org.cleanId,
      project: project.cleanId,
      target: staging.cleanId,
      percentage: 50, // Out of 3 requests, 1 is for Query.me, 2 are done for Query.me so it's 1/3 = 33.3%
      period: 2,
      targets: [production.id, staging.id],
    },
    {
      authToken: owner_access_token,
    }
  );

  expect(updateValidationResult.body.errors).not.toBeDefined();
  expect(updateValidationResult.body.data!.updateTargetValidationSettings.error).toBeNull();
  expect(
    updateValidationResult.body.data!.updateTargetValidationSettings.ok!.updatedTargetValidationSettings.percentage
  ).toEqual(50);
  expect(
    updateValidationResult.body.data!.updateTargetValidationSettings.ok!.updatedTargetValidationSettings.period
  ).toEqual(2);
  expect(
    updateValidationResult.body.data!.updateTargetValidationSettings.ok!.updatedTargetValidationSettings.targets
  ).toHaveLength(2);

  // should be non-breaking because the field is used in production and we are checking staging and production now
  // and it used in less than 50% of traffic
  const usedCheckResult = await checkSchema(
    {
      sdl: `type Query { me: String }`, // ping is used on production and we do check production now
    },
    tokenForStaging
  );

  if (usedCheckResult.body.data!.schemaCheck.__typename !== 'SchemaCheckSuccess') {
    throw new Error(`Expected SchemaCheckSuccess, got ${usedCheckResult.body.data!.schemaCheck.__typename}`);
  }

  expect(usedCheckResult.body.data!.schemaCheck.valid).toEqual(true);
  expect(usedCheckResult.body.errors).not.toBeDefined();
});

test('check usage not from excluded client names', async () => {
  const { access_token: owner_access_token } = await authenticate('main');
  const orgResult = await createOrganization(
    {
      name: 'foo',
    },
    owner_access_token
  );

  const org = orgResult.body.data!.createOrganization.ok!.createdOrganizationPayload.organization;

  const projectResult = await createProject(
    {
      organization: org.cleanId,
      type: ProjectType.Single,
      name: 'foo',
    },
    owner_access_token
  );

  const project = projectResult.body.data!.createProject.ok!.createdProject;
  const production = projectResult.body.data!.createProject.ok!.createdTargets.find(t => t.name === 'production');

  if (!production) {
    throw new Error('No production target');
  }

  const productionTokenResult = await createToken(
    {
      name: 'test',
      organization: org.cleanId,
      project: project.cleanId,
      target: production.cleanId,
      organizationScopes: [OrganizationAccessScope.Read],
      projectScopes: [ProjectAccessScope.Read],
      targetScopes: [TargetAccessScope.Read, TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
    },
    owner_access_token
  );

  expect(productionTokenResult.body.errors).not.toBeDefined();

  const tokenForProduction = productionTokenResult.body.data!.createToken.ok!.secret;

  const schemaPublishResult = await publishSchema(
    {
      author: 'Kamil',
      commit: 'usage-check-2',
      sdl: `type Query { ping: String me: String }`,
    },
    tokenForProduction
  );

  expect(schemaPublishResult.body.errors).not.toBeDefined();
  expect((schemaPublishResult.body.data!.schemaPublish as any).valid).toEqual(true);

  const targetValidationResult = await setTargetValidation(
    {
      enabled: true,
      organization: org.cleanId,
      project: project.cleanId,
      target: production.cleanId,
    },
    {
      authToken: owner_access_token,
    }
  );

  expect(targetValidationResult.body.errors).not.toBeDefined();
  expect(targetValidationResult.body.data!.setTargetValidation.enabled).toEqual(true);
  expect(targetValidationResult.body.data!.setTargetValidation.percentage).toEqual(0);
  expect(targetValidationResult.body.data!.setTargetValidation.period).toEqual(30);

  const collectResult = await collect({
    operations: [
      {
        timestamp: Date.now(),
        operation: 'query ping { ping }',
        operationName: 'ping',
        fields: ['Query', 'Query.ping'],
        execution: {
          ok: true,
          duration: 200000000,
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
          duration: 200000000,
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
          duration: 200000000,
          errorsTotal: 0,
        },
        metadata: {
          client: {
            name: 'app',
            version: '1.0.1',
          },
        },
      },
    ],
    token: tokenForProduction,
  });

  expect(collectResult.status).toEqual(200);

  await waitFor(5_000);

  // should be breaking because the field is used
  const unusedCheckResult = await checkSchema(
    {
      sdl: `type Query { ping: String }`, // Query.me is used
    },
    tokenForProduction
  );
  expect(unusedCheckResult.body.errors).not.toBeDefined();
  expect(unusedCheckResult.body.data!.schemaCheck.__typename).toEqual('SchemaCheckError');

  // Exclude app from the check
  const updateValidationResult = await updateTargetValidationSettings(
    {
      organization: org.cleanId,
      project: project.cleanId,
      target: production.cleanId,
      percentage: 0,
      period: 2,
      targets: [production.id],
      excludedClients: ['app'],
    },
    {
      authToken: owner_access_token,
    }
  );

  expect(updateValidationResult.body.errors).not.toBeDefined();
  expect(updateValidationResult.body.data!.updateTargetValidationSettings.error).toBeNull();
  expect(
    updateValidationResult.body.data!.updateTargetValidationSettings.ok!.updatedTargetValidationSettings.enabled
  ).toBe(true);
  expect(
    updateValidationResult.body.data!.updateTargetValidationSettings.ok!.updatedTargetValidationSettings.excludedClients
  ).toHaveLength(1);
  expect(
    updateValidationResult.body.data!.updateTargetValidationSettings.ok!.updatedTargetValidationSettings.excludedClients
  ).toContainEqual('app');

  // should be safe because the field was not used by the non-excluded clients (cli never requested `Query.me`, but app did)
  const usedCheckResult = await checkSchema(
    {
      sdl: `type Query { ping: String }`,
    },
    tokenForProduction
  );

  if (usedCheckResult.body.data!.schemaCheck.__typename !== 'SchemaCheckSuccess') {
    throw new Error(`Expected SchemaCheckSuccess, got ${usedCheckResult.body.data!.schemaCheck.__typename}`);
  }

  expect(usedCheckResult.body.data!.schemaCheck.valid).toEqual(true);
  expect(usedCheckResult.body.errors).not.toBeDefined();
});

test('number of produced and collected operations should match', async () => {
  const { access_token: owner_access_token } = await authenticate('main');
  const orgResult = await createOrganization(
    {
      name: 'foo',
    },
    owner_access_token
  );

  const org = orgResult.body.data!.createOrganization.ok!.createdOrganizationPayload.organization;

  const projectResult = await createProject(
    {
      organization: org.cleanId,
      type: ProjectType.Single,
      name: 'foo',
    },
    owner_access_token
  );

  const project = projectResult.body.data!.createProject.ok!.createdProject;
  const target = projectResult.body.data!.createProject.ok!.createdTargets[0];

  const tokenResult = await createToken(
    {
      name: 'test',
      organization: org.cleanId,
      project: project.cleanId,
      target: target.cleanId,
      organizationScopes: [OrganizationAccessScope.Read],
      projectScopes: [ProjectAccessScope.Read],
      targetScopes: [TargetAccessScope.Read, TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
    },
    owner_access_token
  );

  expect(tokenResult.body.errors).not.toBeDefined();

  const token = tokenResult.body.data!.createToken.ok!.secret;

  const batchSize = 1000;
  const totalAmount = 10_000;
  for await (const i of new Array(totalAmount / batchSize).fill(null).map((_, i) => i)) {
    await sendBatch(
      batchSize,
      i % 2 === 0
        ? {
            operation: 'query ping { ping }',
            operationName: 'ping',
            fields: ['Query', 'Query.ping'],
            execution: {
              ok: true,
              duration: 200000000,
              errorsTotal: 0,
            },
          }
        : {
            operation: 'query ping { ping }',
            operationName: 'ping',
            fields: ['Query', 'Query.ping'],
            execution: {
              ok: true,
              duration: 200000000,
              errorsTotal: 0,
            },
            metadata: {
              client: {
                name: 'web',
                version: '1.2.3',
              },
            },
          },
      token
    );
  }

  await waitFor(5_000);

  const result = await clickHouseQuery<{
    target: string;
    client_name: string | null;
    hash: string;
    total: number;
  }>(`
    SELECT
      target, client_name, hash, sum(total) as total
    FROM client_names_daily
    WHERE 
      timestamp >= subtractDays(now(), 30)
      AND timestamp <= now()
    GROUP BY target, client_name, hash
  `);

  expect(result.rows).toEqual(2);
  expect(result.data).toContainEqual(
    expect.objectContaining({
      target: target.id,
      client_name: 'web',
      hash: expect.any(String),
      total: expect.stringMatching('5000'),
    })
  );
  expect(result.data).toContainEqual(
    expect.objectContaining({
      target: target.id,
      client_name: '',
      hash: expect.any(String),
      total: expect.stringMatching('5000'),
    })
  );
});

test('different order of schema coordinates should not result in different hash', async () => {
  const { access_token: owner_access_token } = await authenticate('main');
  const orgResult = await createOrganization(
    {
      name: 'foo',
    },
    owner_access_token
  );

  const org = orgResult.body.data!.createOrganization.ok!.createdOrganizationPayload.organization;

  const projectResult = await createProject(
    {
      organization: org.cleanId,
      type: ProjectType.Single,
      name: 'foo',
    },
    owner_access_token
  );

  const project = projectResult.body.data!.createProject.ok!.createdProject;
  const target = projectResult.body.data!.createProject.ok!.createdTargets[0];

  const tokenResult = await createToken(
    {
      name: 'test',
      organization: org.cleanId,
      project: project.cleanId,
      target: target.cleanId,
      organizationScopes: [OrganizationAccessScope.Read],
      projectScopes: [ProjectAccessScope.Read],
      targetScopes: [TargetAccessScope.Read, TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
    },
    owner_access_token
  );

  expect(tokenResult.body.errors).not.toBeDefined();

  const token = tokenResult.body.data!.createToken.ok!.secret;

  await collect({
    operations: [
      {
        operation: 'query ping {        ping      }',
        operationName: 'ping',
        fields: ['Query', 'Query.ping'],
        execution: {
          ok: true,
          duration: 200000000,
          errorsTotal: 0,
        },
      },
      {
        operation: 'query ping { ping }',
        operationName: 'ping',
        fields: ['Query.ping', 'Query'],
        execution: {
          ok: true,
          duration: 200000000,
          errorsTotal: 0,
        },
      },
    ],
    token,
  });

  await waitFor(5_000);

  const coordinatesResult = await clickHouseQuery<{
    target: string;
    client_name: string | null;
    hash: string;
    total: number;
  }>(`
    SELECT coordinate, hash FROM schema_coordinates_daily GROUP BY coordinate, hash
  `);

  expect(coordinatesResult.rows).toEqual(2);

  const operationsResult = await clickHouseQuery<{
    target: string;
    client_name: string | null;
    hash: string;
    total: number;
  }>(`
    SELECT hash FROM operations_registry FINAL GROUP BY hash
  `);

  expect(operationsResult.rows).toEqual(1);
});

test('same operation but with different schema coordinates should result in different hash', async () => {
  const { access_token: owner_access_token } = await authenticate('main');
  const orgResult = await createOrganization(
    {
      name: 'foo',
    },
    owner_access_token
  );

  const org = orgResult.body.data!.createOrganization.ok!.createdOrganizationPayload.organization;

  const projectResult = await createProject(
    {
      organization: org.cleanId,
      type: ProjectType.Single,
      name: 'foo',
    },
    owner_access_token
  );

  const project = projectResult.body.data!.createProject.ok!.createdProject;
  const target = projectResult.body.data!.createProject.ok!.createdTargets[0];

  const tokenResult = await createToken(
    {
      name: 'test',
      organization: org.cleanId,
      project: project.cleanId,
      target: target.cleanId,
      organizationScopes: [OrganizationAccessScope.Read],
      projectScopes: [ProjectAccessScope.Read],
      targetScopes: [TargetAccessScope.Read, TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
    },
    owner_access_token
  );

  expect(tokenResult.body.errors).not.toBeDefined();

  const token = tokenResult.body.data!.createToken.ok!.secret;

  await collect({
    operations: [
      {
        operation: 'query ping {        ping      }',
        operationName: 'ping',
        fields: ['Query', 'Query.ping'],
        execution: {
          ok: true,
          duration: 200000000,
          errorsTotal: 0,
        },
      },
      {
        operation: 'query ping { ping }',
        operationName: 'ping',
        fields: ['RootQuery', 'RootQuery.ping'],
        execution: {
          ok: true,
          duration: 200000000,
          errorsTotal: 0,
        },
      },
    ],
    token,
  });

  await waitFor(5_000);

  const coordinatesResult = await clickHouseQuery<{
    target: string;
    client_name: string | null;
    hash: string;
    total: number;
  }>(`
    SELECT coordinate, hash FROM schema_coordinates_daily GROUP BY coordinate, hash
  `);

  expect(coordinatesResult.rows).toEqual(4);

  const operationsResult = await clickHouseQuery<{
    target: string;
    client_name: string | null;
    hash: string;
    total: number;
  }>(`
    SELECT hash FROM operations_registry FINAL GROUP BY hash
  `);

  expect(operationsResult.rows).toEqual(2);
});
