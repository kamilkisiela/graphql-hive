import {
  OrganizationAccessScope,
  ProjectAccessScope,
  ProjectType,
  TargetAccessScope,
} from '@app/gql/graphql';
import { clickHouseQuery } from '../../../testkit/clickhouse';
import { updateOrgRateLimit, waitFor } from '../../../testkit/flow';
import { rateLimitApi } from '../../../testkit/rate-limit';
import { initSeed } from '../../../testkit/seed';

test('rate limit update', async () => {
  const { createOrg, ownerToken } = await initSeed().createOwner();
  const { createProject, organization } = await createOrg();
  const { createToken, target } = await createProject(ProjectType.Single);

  await updateOrgRateLimit(
    {
      organization: organization.cleanId,
    },
    {
      operations: 11,
    },
    ownerToken,
  );

  const { collectOperations, secret } = await createToken({
    targetScopes: [
      TargetAccessScope.Read,
      TargetAccessScope.RegistryRead,
      TargetAccessScope.RegistryWrite,
    ],
    projectScopes: [ProjectAccessScope.Read],
    organizationScopes: [OrganizationAccessScope.Read],
  });

  const op = {
    operation: 'query ping { ping }',
    operationName: 'ping',
    fields: ['Query', 'Query.ping'],
    execution: {
      ok: true,
      duration: 200_000_000,
      errorsTotal: 0,
    },
  };

  // Collect operations and check for warning
  const collectResult = await collectOperations(new Array(12).fill(op));
  expect(collectResult.status).toEqual(200);

  await waitFor(5000);

  // check if rate-limited
  await expect(
    rateLimitApi.checkRateLimit.query({
      id: organization.id,
      type: 'operations-reporting',
      entityType: 'organization',
      token: secret,
    }),
  ).resolves.toEqual(
    expect.objectContaining({
      limited: true,
    }),
  );

  await waitFor(5000);

  // Send more operations
  expect(collectOperations([op, op])).resolves.toEqual(
    expect.objectContaining({
      status: 429,
    }),
  );

  // update the limits
  await updateOrgRateLimit(
    {
      organization: organization.cleanId,
    },
    {
      operations: 20,
    },
    ownerToken,
  );

  await waitFor(5000);

  // check if rate-limited
  await expect(
    rateLimitApi.checkRateLimit.query({
      id: organization.id,
      type: 'operations-reporting',
      entityType: 'organization',
      token: secret,
    }),
  ).resolves.toEqual(
    expect.objectContaining({
      limited: false,
    }),
  );

  // Send more operations
  expect(collectOperations([op, op])).resolves.toEqual(
    expect.objectContaining({
      status: 200,
    }),
  );

  await waitFor(5000);

  const operationsResult = await clickHouseQuery<{
    total: string;
  }>(`
    SELECT count() as total FROM operations WHERE target = '${target.id}'
  `);

  expect(operationsResult.rows).toEqual(1);
  expect(operationsResult.data[0].total).toEqual('14');
});
