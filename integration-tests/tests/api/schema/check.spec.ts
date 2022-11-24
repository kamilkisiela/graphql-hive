import { TargetAccessScope, ProjectType } from '@app/gql/graphql';
import {
  createOrganization,
  joinOrganization,
  publishSchema,
  checkSchema,
  createProject,
  createToken,
  inviteToOrganization,
} from '../../../testkit/flow';
import { authenticate } from '../../../testkit/auth';

test('can check a schema with target:registry:read access', async () => {
  const { access_token: owner_access_token } = await authenticate('main');
  const orgResult = await createOrganization(
    {
      name: 'foo',
    },
    owner_access_token,
  );
  const org = orgResult.body.data!.createOrganization.ok!.createdOrganizationPayload.organization;

  const invitationResult = await inviteToOrganization(
    {
      email: 'some@email.com',
      organization: org.cleanId,
    },
    owner_access_token,
  );

  const inviteCode = invitationResult.body.data?.inviteToOrganizationByEmail.ok?.code;
  expect(inviteCode).toBeDefined();

  // Join
  const { access_token: member_access_token } = await authenticate('extra');
  await joinOrganization(inviteCode!, member_access_token);

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
      projectScopes: [],
      targetScopes: [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
    },
    owner_access_token,
  );
  expect(writeTokenResult.body.errors).not.toBeDefined();
  const writeToken = writeTokenResult.body.data!.createToken.ok!.secret;

  // Publish schema with write rights
  const publishResult = await publishSchema(
    {
      author: 'Kamil',
      commit: 'abc123',
      sdl: `type Query { ping: String }`,
    },
    writeToken,
  );

  // Schema publish should be successful
  expect(publishResult.body.errors).not.toBeDefined();
  expect(publishResult.body.data!.schemaPublish.__typename).toBe('SchemaPublishSuccess');

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
      projectScopes: [],
      targetScopes: [TargetAccessScope.RegistryRead],
    },
    owner_access_token,
  );
  expect(readTokenResult.body.errors).not.toBeDefined();

  const readToken = readTokenResult.body.data!.createToken.ok!.secret;
  const noAccessToken = noAccessTokenResult.body.data!.createToken.ok!.secret;

  // Check schema with no read and write rights
  let checkResult = await checkSchema(
    {
      sdl: `type Query { ping: String foo: String }`,
    },
    noAccessToken,
  );
  expect(checkResult.body.errors).toHaveLength(1);
  expect(checkResult.body.errors![0].message).toMatch('target:registry:read');

  // Check schema with read rights
  checkResult = await checkSchema(
    {
      sdl: `type Query { ping: String foo: String }`,
    },
    readToken,
  );
  expect(checkResult.body.errors).not.toBeDefined();
  expect(checkResult.body.data!.schemaCheck.__typename).toBe('SchemaCheckSuccess');
});

test('should match indentation of previous description', async () => {
  const { access_token: owner_access_token } = await authenticate('main');
  const orgResult = await createOrganization(
    {
      name: 'foo',
    },
    owner_access_token,
  );
  const org = orgResult.body.data!.createOrganization.ok!.createdOrganizationPayload.organization;

  const invitationResult = await inviteToOrganization(
    {
      email: 'some@email.com',
      organization: org.cleanId,
    },
    owner_access_token,
  );

  const inviteCode = invitationResult.body.data?.inviteToOrganizationByEmail.ok?.code;
  expect(inviteCode).toBeDefined();

  // Join
  const { access_token: member_access_token } = await authenticate('extra');
  await joinOrganization(inviteCode!, member_access_token);

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
      projectScopes: [],
      targetScopes: [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
    },
    owner_access_token,
  );
  expect(writeTokenResult.body.errors).not.toBeDefined();
  const writeToken = writeTokenResult.body.data!.createToken.ok!.secret;

  // Publish schema with write rights
  const publishResult = await publishSchema(
    {
      author: 'Kamil',
      commit: 'abc123',
      sdl: `
        type Query {
          " ping-ping  "
          ping: String
          "pong-pong"
          pong: String
        }
      `,
    },
    writeToken,
  );

  // Schema publish should be successful
  expect(publishResult.body.errors).not.toBeDefined();
  expect(publishResult.body.data!.schemaPublish.__typename).toBe('SchemaPublishSuccess');

  // Create a token with read rights
  const readTokenResult = await createToken(
    {
      name: 'test',
      organization: org.cleanId,
      project: project.cleanId,
      target: target.cleanId,
      organizationScopes: [],
      projectScopes: [],
      targetScopes: [TargetAccessScope.RegistryRead],
    },
    owner_access_token,
  );
  expect(readTokenResult.body.errors).not.toBeDefined();

  const readToken = readTokenResult.body.data!.createToken.ok!.secret;

  // Check schema with read rights
  const checkResult = await checkSchema(
    {
      sdl: `
        type Query {
          """
          ping-ping
          """
          ping: String
          " pong-pong "
          pong: String
        }
      `,
    },
    readToken,
  );
  expect(checkResult.body.errors).not.toBeDefined();

  const check = checkResult.body.data!.schemaCheck;

  if (check.__typename !== 'SchemaCheckSuccess') {
    throw new Error(`Expected SchemaCheckSuccess, got ${check.__typename}`);
  }

  expect(check.__typename).toBe('SchemaCheckSuccess');
  expect(check.changes!.total).toBe(0);
});
