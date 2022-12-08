import { TargetAccessScope, ProjectType } from '@app/gql/graphql';
import formatISO from 'date-fns/formatISO';
import subHours from 'date-fns/subHours';
import { authenticate } from '../../testkit/auth';
import {
  publishSchema,
  createOrganization,
  createProject,
  createToken,
  readOperationsStats,
  waitFor,
} from '../../testkit/flow';
import { collect } from '../../testkit/usage';

test('X-API-Token header should work when calling GraphQL API and collecting usage', async () => {
  const { access_token: owner_access_token } = await authenticate('main');
  const orgResult = await createOrganization(
    {
      name: 'foo',
    },
    owner_access_token,
  );

  const org = orgResult.body.data!.createOrganization.ok!.createdOrganizationPayload.organization;

  const projectResult = await createProject(
    {
      organization: org.cleanId,
      type: ProjectType.Single,
      name: 'foo',
    },
    owner_access_token,
  );

  const project = projectResult.body.data!.createProject.ok!.createdProject;
  const target = projectResult.body.data!.createProject.ok!.createdTargets[0];

  const tokenResult = await createToken(
    {
      name: 'test',
      organization: org.cleanId,
      project: project.cleanId,
      target: target.cleanId,
      organizationScopes: [],
      projectScopes: [],
      targetScopes: [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
    },
    owner_access_token,
  );

  expect(tokenResult.body.errors).not.toBeDefined();

  const token = tokenResult.body.data!.createToken.ok!.secret;

  const result = await publishSchema(
    {
      author: 'Kamil',
      commit: 'abc123',
      sdl: `type Query { ping: String }`,
    },
    token,
    'x-api-token',
  );

  expect(result.body.errors).not.toBeDefined();
  expect(result.body.data!.schemaPublish.__typename).toBe('SchemaPublishSuccess');

  const collectResult = await collect({
    operations: [
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
    ],
    token,
    authorizationHeader: 'x-api-token',
  });

  expect(collectResult.status).toEqual(200);

  await waitFor(5000);

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
    token,
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
