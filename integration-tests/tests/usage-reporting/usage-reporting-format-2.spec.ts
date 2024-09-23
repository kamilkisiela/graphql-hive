import { initSeed } from 'testkit/seed';
import { TargetAccessScope } from '../../testkit/gql/graphql';
import { getServiceHost } from '../../testkit/utils';

test('valid operation is accepted', async () => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject } = await createOrg();
  const { createToken } = await createProject();
  const { secret: accessToken } = await createToken({
    targetScopes: [TargetAccessScope.RegistryWrite, TargetAccessScope.RegistryRead],
  });

  const usageAddress = await getServiceHost('usage', 8081);

  const response = await fetch(`http://${usageAddress}`, {
    method: 'POST',
    headers: {
      'X-Usage-API-Version': '2',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      size: 3,
      map: {
        c3b6d9b0: {
          operationName: 'me',
          operation: 'query me { me { id name } }',
          fields: ['Query', 'Query.me', 'User', 'User.id', 'User.name'],
        },
      },
      operations: [
        {
          operationMapKey: 'c3b6d9b0',
          timestamp: 1663158676535,
          execution: {
            ok: true,
            duration: 150000000,
            errorsTotal: 0,
          },
          metadata: {
            client: {
              name: 'demo',
              version: '0.0.1',
            },
          },
        },
      ],
    }),
  });
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    id: expect.any(String),
    operations: {
      accepted: 1,
      rejected: 0,
    },
  });
});

test('invalid operation is rejected', async () => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject } = await createOrg();
  const { createToken } = await createProject();
  const { secret: accessToken } = await createToken({
    targetScopes: [TargetAccessScope.RegistryWrite, TargetAccessScope.RegistryRead],
  });

  const usageAddress = await getServiceHost('usage', 8081);
  // GraphQL operation is invalid at Query.me(id:)
  const faultyOperation = 'query me { me(id: ) { id name } }';

  const response = await fetch(`http://${usageAddress}`, {
    method: 'POST',
    headers: {
      'X-Usage-API-Version': '2',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      size: 3,
      map: {
        c3b6d9b0: {
          operationName: 'me',
          operation: faultyOperation,
          fields: ['Query', 'Query.me', 'User', 'User.id', 'User.name'],
        },
      },
      operations: [
        {
          operationMapKey: 'c3b6d9b0',
          timestamp: 1663158676535,
          execution: {
            ok: true,
            duration: 150000000,
            errorsTotal: 0,
          },
          metadata: {
            client: {
              name: 'demo',
              version: '0.0.1',
            },
          },
        },
      ],
    }),
  });
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    id: expect.any(String),
    operations: {
      accepted: 0,
      rejected: 1,
    },
  });
});
