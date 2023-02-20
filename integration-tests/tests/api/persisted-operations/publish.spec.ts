import { ProjectAccessScope, ProjectType } from '@app/gql/graphql';
import { publishPersistedOperations } from '../../../testkit/flow';
import { initSeed } from '../../../testkit/seed';

test.concurrent(
  'can publish persisted operations only with project:operations-store:write',
  async () => {
    const { createOrg } = await initSeed().createOwner();
    const { createProject } = await createOrg();
    const { createToken } = await createProject(ProjectType.Single);
    // Create a token with no rights
    const { secret: noAccessToken } = await createToken({
      targetScopes: [],
      projectScopes: [],
      organizationScopes: [],
    });
    // Create a token with read rights
    const { secret: readToken } = await createToken({
      targetScopes: [],
      projectScopes: [ProjectAccessScope.OperationsStoreRead],
      organizationScopes: [],
    });
    // Create a token with write rights
    const { secret: writeToken } = await createToken({
      targetScopes: [],
      projectScopes: [
        ProjectAccessScope.OperationsStoreRead,
        ProjectAccessScope.OperationsStoreWrite,
      ],
      organizationScopes: [],
    });

    const operations = [
      {
        content: `query Me { me { id } }`,
        operationHash: 'meme',
      },
      {
        content: `query user($id: ID!) { user(id: $id) { id } }`,
      },
    ];

    // Cannot persist operations with no read and write rights
    const noAccessErrors = await publishPersistedOperations(operations, noAccessToken).then(r =>
      r.expectGraphQLErrors(),
    );
    expect(noAccessErrors).toHaveLength(1);
    expect(noAccessErrors[0].message).toMatch('project:operations-store:write');

    // Cannot persist operations with read rights
    const readTokenErrors = await publishPersistedOperations(operations, readToken).then(r =>
      r.expectGraphQLErrors(),
    );
    expect(readTokenErrors).toHaveLength(1);
    expect(readTokenErrors[0].message).toMatch('project:operations-store:write');

    // Persist operations with write rights
    const writeResult = await publishPersistedOperations(operations, writeToken).then(r =>
      r.expectNoGraphQLErrors(),
    );
    const persisted = writeResult.publishPersistedOperations;

    // Check the result
    expect(persisted.summary.total).toEqual(2);
    expect(persisted.summary.unchanged).toEqual(0);
    expect(persisted.operations).toHaveLength(2);
    expect(persisted.operations[0].operationHash).toEqual(operations[0].operationHash);
    expect(persisted.operations[1].operationHash).toBeDefined();
  },
);

test.concurrent('should skip on already persisted operations', async () => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject } = await createOrg();
  const { createToken } = await createProject(ProjectType.Single);

  // Create a token with write rights
  const { secret: writeToken } = await createToken({
    targetScopes: [],
    projectScopes: [
      ProjectAccessScope.OperationsStoreRead,
      ProjectAccessScope.OperationsStoreWrite,
    ],
    organizationScopes: [],
  });

  const operations = [
    {
      content: `query Me { me { id } }`,
      operationHash: 'meme',
    },
    {
      content: `query user($id: ID!) { user(id: $id) { id } }`,
    },
  ];

  // Persist operations
  const result = await publishPersistedOperations(operations, writeToken).then(r =>
    r.expectNoGraphQLErrors(),
  );
  const persisted = result.publishPersistedOperations;

  // Check the result
  expect(persisted.summary.total).toEqual(2);
  expect(persisted.summary.unchanged).toEqual(0);
  expect(persisted.operations).toHaveLength(2);
  expect(persisted.operations[0].operationHash).toEqual(operations[0].operationHash);
  expect(persisted.operations[1].operationHash).toBeDefined();

  // Persist operations with read rights
  operations[1].operationHash = 'useruser';
  const publishModifyResult = await publishPersistedOperations(operations, writeToken).then(r =>
    r.expectNoGraphQLErrors(),
  );

  const modifiedPersisted = publishModifyResult.publishPersistedOperations;

  // Check the result
  expect(modifiedPersisted.summary.total).toEqual(2);
  expect(modifiedPersisted.summary.unchanged).toEqual(1);
  expect(modifiedPersisted.operations).toHaveLength(2);

  const meOperation = modifiedPersisted.operations.find(
    op => op.operationHash === operations[0].operationHash,
  );
  const userOperation = modifiedPersisted.operations.find(
    op => op.operationHash === operations[1].operationHash,
  );

  expect(meOperation?.operationHash).toEqual(operations[0].operationHash);
  expect(userOperation?.operationHash).toEqual(operations[1].operationHash);
});
