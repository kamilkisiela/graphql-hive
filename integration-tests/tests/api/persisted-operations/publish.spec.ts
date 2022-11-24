import { ProjectType, ProjectAccessScope } from '@app/gql/graphql';
import {
  createOrganization,
  publishPersistedOperations,
  createProject,
  createToken,
} from '../../../testkit/flow';
import { authenticate } from '../../../testkit/auth';

test('can publish persisted operations only with project:operations-store:write', async () => {
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

  // Create a token with no rights
  const noAccessTokenResult = await createToken(
    {
      name: 'test',
      organization: org.cleanId,
      project: project.cleanId,
      target: target.cleanId,
      organizationScopes: [],
      projectScopes: [],
      targetScopes: [],
    },
    owner_access_token,
  );
  expect(noAccessTokenResult.body.errors).not.toBeDefined();

  // Create a token with read rights
  const readTokenResult = await createToken(
    {
      name: 'test',
      organization: org.cleanId,
      project: project.cleanId,
      target: target.cleanId,
      organizationScopes: [],
      projectScopes: [ProjectAccessScope.OperationsStoreRead],
      targetScopes: [],
    },
    owner_access_token,
  );
  expect(readTokenResult.body.errors).not.toBeDefined();

  // Create a token with write rights
  const writeTokenResult = await createToken(
    {
      name: 'test',
      organization: org.cleanId,
      project: project.cleanId,
      target: target.cleanId,
      organizationScopes: [],
      projectScopes: [
        ProjectAccessScope.OperationsStoreRead,
        ProjectAccessScope.OperationsStoreWrite,
      ],
      targetScopes: [],
    },
    owner_access_token,
  );
  expect(writeTokenResult.body.errors).not.toBeDefined();

  const writeToken = writeTokenResult.body.data!.createToken.ok!.secret;
  const readToken = readTokenResult.body.data!.createToken.ok!.secret;
  const noAccessToken = noAccessTokenResult.body.data!.createToken.ok!.secret;

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
  let result = await publishPersistedOperations(operations, noAccessToken);
  expect(result.body.errors).toHaveLength(1);
  expect(result.body.errors![0].message).toMatch('project:operations-store:write');

  // Cannot persist operations with read rights
  result = await publishPersistedOperations(operations, readToken);
  expect(result.body.errors).toHaveLength(1);
  expect(result.body.errors![0].message).toMatch('project:operations-store:write');

  // Persist operations with write rights
  result = await publishPersistedOperations(operations, writeToken);
  expect(result.body.errors).not.toBeDefined();

  const persisted = result.body.data!.publishPersistedOperations;

  // Check the result
  expect(persisted.summary.total).toEqual(2);
  expect(persisted.summary.unchanged).toEqual(0);
  expect(persisted.operations).toHaveLength(2);
  expect(persisted.operations[0].operationHash).toEqual(operations[0].operationHash);
  expect(persisted.operations[1].operationHash).toBeDefined();
});

test('should skip on already persisted operations', async () => {
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

  // Create a token with write rights
  const writeTokenResult = await createToken(
    {
      name: 'test',
      organization: org.cleanId,
      project: project.cleanId,
      target: target.cleanId,
      organizationScopes: [],
      projectScopes: [
        ProjectAccessScope.OperationsStoreRead,
        ProjectAccessScope.OperationsStoreWrite,
      ],
      targetScopes: [],
    },
    owner_access_token,
  );
  expect(writeTokenResult.body.errors).not.toBeDefined();

  const writeToken = writeTokenResult.body.data!.createToken.ok!.secret;

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
  let result = await publishPersistedOperations(operations, writeToken);
  expect(result.body.errors).not.toBeDefined();

  let persisted = result.body.data!.publishPersistedOperations;

  // Check the result
  expect(persisted.summary.total).toEqual(2);
  expect(persisted.summary.unchanged).toEqual(0);
  expect(persisted.operations).toHaveLength(2);
  expect(persisted.operations[0].operationHash).toEqual(operations[0].operationHash);
  expect(persisted.operations[1].operationHash).toBeDefined();

  // Persist operations with read rights
  operations[1].operationHash = 'useruser';
  result = await publishPersistedOperations(operations, writeToken);
  expect(result.body.errors).not.toBeDefined();

  persisted = result.body.data!.publishPersistedOperations;

  // Check the result
  expect(persisted.summary.total).toEqual(2);
  expect(persisted.summary.unchanged).toEqual(1);
  expect(persisted.operations).toHaveLength(2);

  const meOperation = persisted.operations.find(
    op => op.operationHash === operations[0].operationHash,
  );
  const userOperation = persisted.operations.find(
    op => op.operationHash === operations[1].operationHash,
  );

  expect(meOperation?.operationHash).toEqual(operations[0].operationHash);
  expect(userOperation?.operationHash).toEqual(operations[1].operationHash);
});
