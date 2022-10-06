import { TargetAccessScope, ProjectType } from '@app/gql/graphql';
import {
  createOrganization,
  joinOrganization,
  publishSchema,
  createProject,
  createToken,
  updateBaseSchema,
  fetchVersions,
  fetchLatestSchema,
  fetchLatestValidSchema,
  updateSchemaVersionStatus,
  fetchSchemaFromCDN,
  createTarget,
  fetchMetadataFromCDN,
  createCdnAccess,
  inviteToOrganization,
} from '../../../testkit/flow';
import { authenticate } from '../../../testkit/auth';
import { fetch } from '@whatwg-node/fetch';

test('cannot publish a schema without target:registry:write access', async () => {
  const { access_token: owner_access_token } = await authenticate('main');
  const orgResult = await createOrganization(
    {
      name: 'foo',
    },
    owner_access_token
  );

  // Join
  const { access_token: member_access_token } = await authenticate('extra');
  const org = orgResult.body.data!.createOrganization.ok!.createdOrganizationPayload.organization;

  const invitationResult = await inviteToOrganization(
    {
      email: 'some@email.com',
      organization: org.cleanId,
    },
    owner_access_token
  );

  const inviteCode = invitationResult.body.data?.inviteToOrganizationByEmail.ok?.code;
  expect(inviteCode).toBeDefined();

  await joinOrganization(inviteCode!, member_access_token);

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
      organizationScopes: [],
      projectScopes: [],
      targetScopes: [TargetAccessScope.RegistryRead],
    },
    owner_access_token
  );
  expect(tokenResult.body.errors).not.toBeDefined();

  const token = tokenResult.body.data!.createToken.ok!.secret;
  const result = await publishSchema(
    {
      author: 'Kamil',
      commit: 'abc123',
      sdl: `type Query { ping: String }`,
    },
    token
  );

  expect(result.body.errors).toHaveLength(1);
  expect(result.body.errors![0].message).toMatch('target:registry:write');
});

test('can publish a schema with target:registry:write access', async () => {
  const { access_token: owner_access_token } = await authenticate('main');
  const orgResult = await createOrganization(
    {
      name: 'foo',
    },
    owner_access_token
  );

  // Join
  const { access_token: member_access_token } = await authenticate('extra');
  const org = orgResult.body.data!.createOrganization.ok!.createdOrganizationPayload.organization;

  const invitationResult = await inviteToOrganization(
    {
      email: 'some@email.com',
      organization: org.cleanId,
    },
    owner_access_token
  );

  const inviteCode = invitationResult.body.data?.inviteToOrganizationByEmail.ok?.code;
  expect(inviteCode).toBeDefined();

  await joinOrganization(inviteCode!, member_access_token);

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
      organizationScopes: [],
      projectScopes: [],
      targetScopes: [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
    },
    owner_access_token
  );

  expect(tokenResult.body.errors).not.toBeDefined();

  const token = tokenResult.body.data!.createToken.ok!.secret;

  let result = await publishSchema(
    {
      author: 'Kamil',
      commit: 'abc123',
      sdl: `type Query { ping: String }`,
    },
    token
  );

  expect(result.body.errors).not.toBeDefined();
  expect(result.body.data!.schemaPublish.__typename).toBe('SchemaPublishSuccess');

  result = await publishSchema(
    {
      author: 'Kamil',
      commit: 'abc123',
      sdl: `type Query { ping: String pong: String }`,
    },
    token
  );

  expect(result.body.errors).not.toBeDefined();
  expect(result.body.data!.schemaPublish.__typename).toBe('SchemaPublishSuccess');

  const versionsResult = await fetchVersions(
    {
      organization: org.cleanId,
      project: project.cleanId,
      target: target.cleanId,
    },
    3,
    token
  );

  expect(versionsResult.body.errors).not.toBeDefined();
  expect(versionsResult.body.data!.schemaVersions.nodes).toHaveLength(2);
});

test('base schema should not affect the output schema persisted in db', async () => {
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
    owner_access_token
  );
  expect(writeTokenResult.body.errors).not.toBeDefined();
  const writeToken = writeTokenResult.body.data!.createToken.ok!.secret;

  // Publish schema with write rights
  let publishResult = await publishSchema(
    {
      author: 'Kamil',
      commit: 'abc123',
      sdl: `type Query { ping: String }`,
    },
    writeToken
  );

  // Schema publish should be successful
  expect(publishResult.body.errors).not.toBeDefined();
  expect(publishResult.body.data!.schemaPublish.__typename).toBe('SchemaPublishSuccess');

  const updateBaseResult = await updateBaseSchema(
    {
      newBase: `
        directive @auth on OBJECT | FIELD_DEFINITION
      `,
      organization: org.cleanId,
      project: project.cleanId,
      target: target.cleanId,
    },
    writeToken
  );
  expect(updateBaseResult.body.errors).not.toBeDefined();

  // Check schema with no read and write rights
  publishResult = await publishSchema(
    {
      sdl: `type Query { ping: String @auth pong: String }`,
      author: 'Kamil',
      commit: 'abc234',
    },
    writeToken
  );
  expect(publishResult.body.errors).not.toBeDefined();
  expect(publishResult.body.data!.schemaPublish.__typename).toBe('SchemaPublishSuccess');

  const versionsResult = await fetchVersions(
    {
      organization: org.cleanId,
      project: project.cleanId,
      target: target.cleanId,
    },
    5,
    writeToken
  );

  expect(versionsResult.body.errors).not.toBeDefined();
  expect(versionsResult.body.data!.schemaVersions.nodes).toHaveLength(2);

  const latestResult = await fetchLatestSchema(writeToken);
  expect(latestResult.body.errors).not.toBeDefined();
  expect(latestResult.body.data!.latestVersion.schemas.total).toBe(1);
  expect(latestResult.body.data!.latestVersion.schemas.nodes[0].commit).toBe('abc234');
  expect(latestResult.body.data!.latestVersion.schemas.nodes[0].source).toMatch(
    'type Query { ping: String @auth pong: String }'
  );
  expect(latestResult.body.data!.latestVersion.schemas.nodes[0].source).not.toMatch('directive');
  expect(latestResult.body.data!.latestVersion.baseSchema).toMatch('directive @auth on OBJECT | FIELD_DEFINITION');
});

test('directives should not be removed (federation)', async () => {
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
      type: ProjectType.Federation,
      name: 'foo',
    },
    owner_access_token
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
    owner_access_token
  );
  expect(writeTokenResult.body.errors).not.toBeDefined();
  const writeToken = writeTokenResult.body.data!.createToken.ok!.secret;

  // Publish schema with write rights
  const publishResult = await publishSchema(
    {
      author: 'Kamil',
      commit: 'abc123',
      url: 'https://api.com/users',
      service: 'users',
      sdl: `type Query { me: User } type User @key(fields: "id") { id: ID! name: String }`,
    },
    writeToken
  );

  // Schema publish should be successful
  expect(publishResult.body.errors).not.toBeDefined();
  expect(publishResult.body.data!.schemaPublish.__typename).toBe('SchemaPublishSuccess');

  const versionsResult = await fetchVersions(
    {
      organization: org.cleanId,
      project: project.cleanId,
      target: target.cleanId,
    },
    5,
    writeToken
  );

  expect(versionsResult.body.errors).not.toBeDefined();
  expect(versionsResult.body.data!.schemaVersions.nodes).toHaveLength(1);

  const latestResult = await fetchLatestSchema(writeToken);
  expect(latestResult.body.errors).not.toBeDefined();
  expect(latestResult.body.data!.latestVersion.schemas.total).toBe(1);
  expect(latestResult.body.data!.latestVersion.schemas.nodes[0].commit).toBe('abc123');
  expect(latestResult.body.data!.latestVersion.schemas.nodes[0].source).toMatch(
    `type Query { me: User } type User @key(fields: "id") { id: ID! name: String }`
  );
});

test('should allow to update the URL of a Federated service without changing the schema', async () => {
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
      type: ProjectType.Federation,
      name: 'foo',
    },
    owner_access_token
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
    owner_access_token
  );
  expect(writeTokenResult.body.errors).not.toBeDefined();
  const writeToken = writeTokenResult.body.data!.createToken.ok!.secret;

  const basePublishParams = {
    service: 'test',
    author: 'Kamil',
    commit: 'abc123',
    url: 'https://api.com/users',
    sdl: `type Query { me: User } type User @key(fields: "id") { id: ID! name: String }`,
  };

  const publishResult = await publishSchema(basePublishParams, writeToken);

  // Schema publish should be successful
  expect(publishResult.body.errors).not.toBeDefined();
  expect(publishResult.body.data!.schemaPublish.__typename).toBe('SchemaPublishSuccess');

  const versionsResult = await fetchVersions(
    {
      organization: org.cleanId,
      project: project.cleanId,
      target: target.cleanId,
    },
    5,
    writeToken
  );

  expect(versionsResult.body.errors).not.toBeDefined();
  expect(versionsResult.body.data!.schemaVersions.nodes).toHaveLength(1);

  // try to update the schema again, with force and url set
  const updateResult = await publishSchema(
    {
      ...basePublishParams,
      url: `http://localhost:3000/test/graphql`,
      commit: 'abc1234',
    },
    writeToken
  );

  expect(updateResult.body.errors).not.toBeDefined();
  expect(updateResult.body.data!.schemaPublish.__typename).toBe('SchemaPublishSuccess');
  expect((updateResult.body.data!.schemaPublish as any).message).toBe(
    'Updated: New service url: http://localhost:3000/test/graphql (previously: https://api.com/users)'
  );

  const latestResult = await fetchLatestSchema(writeToken);
  expect(latestResult.body.errors).not.toBeDefined();
  expect(latestResult.body.data!.latestVersion.schemas.total).toBe(1);
  expect(latestResult.body.data!.latestVersion.schemas.nodes[0].commit).toBe('abc1234');
  expect(latestResult.body.data!.latestVersion.schemas.nodes[0].url).toBe('http://localhost:3000/test/graphql');
  expect(latestResult.body.data!.latestVersion.schemas.nodes[0].source).toMatch(
    `type Query { me: User } type User @key(fields: "id") { id: ID! name: String }`
  );
});

test('should allow to update the URL of a Federated service while also changing the schema', async () => {
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
      type: ProjectType.Federation,
      name: 'foo',
    },
    owner_access_token
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
    owner_access_token
  );
  expect(writeTokenResult.body.errors).not.toBeDefined();
  const writeToken = writeTokenResult.body.data!.createToken.ok!.secret;

  const basePublishParams = {
    service: 'test',
    author: 'Kamil',
    commit: 'abc123',
    url: 'https://api.com/users',
    sdl: `type Query { me: User } type User @key(fields: "id") { id: ID! name: String }`,
  };

  const publishResult = await publishSchema(basePublishParams, writeToken);

  // Schema publish should be successful
  expect(publishResult.body.errors).not.toBeDefined();
  expect(publishResult.body.data!.schemaPublish.__typename).toBe('SchemaPublishSuccess');

  const versionsResult = await fetchVersions(
    {
      organization: org.cleanId,
      project: project.cleanId,
      target: target.cleanId,
    },
    5,
    writeToken
  );

  expect(versionsResult.body.errors).not.toBeDefined();
  expect(versionsResult.body.data!.schemaVersions.nodes).toHaveLength(1);

  const latestResult = await fetchLatestSchema(writeToken);
  expect(latestResult.body.errors).not.toBeDefined();
  expect(latestResult.body.data!.latestVersion.schemas.total).toBe(1);
  expect(latestResult.body.data!.latestVersion.schemas.nodes[0].commit).toBe('abc123');
  expect(latestResult.body.data!.latestVersion.schemas.nodes[0].source).toMatch(
    `type Query { me: User } type User @key(fields: "id") { id: ID! name: String }`
  );

  // try to update the schema again, with force and url set
  const updateResult = await publishSchema(
    {
      ...basePublishParams,
      force: true,
      url: `http://localhost:3000/test/graphql`,
      // here, we also add something minor to the schema, just to trigger the publish flow and not just the URL update flow
      sdl: `type Query { me: User } type User @key(fields: "id") { id: ID! name: String age: Int }`,
    },
    writeToken
  );

  expect(updateResult.body.errors).not.toBeDefined();
  expect(updateResult.body.data!.schemaPublish.__typename).toBe('SchemaPublishSuccess');
});

test('directives should not be removed (stitching)', async () => {
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
      type: ProjectType.Stitching,
      name: 'foo',
    },
    owner_access_token
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
    owner_access_token
  );
  expect(writeTokenResult.body.errors).not.toBeDefined();
  const writeToken = writeTokenResult.body.data!.createToken.ok!.secret;

  // Publish schema with write rights
  const publishResult = await publishSchema(
    {
      author: 'Kamil',
      commit: 'abc123',
      sdl: `type Query { me: User } type User @key(selectionSet: "{ id }") { id: ID! name: String }`,
      service: 'test',
      url: 'https://api.com/users',
    },
    writeToken
  );

  // Schema publish should be successful
  expect(publishResult.body.errors).not.toBeDefined();
  expect(publishResult.body.data!.schemaPublish.__typename).toBe('SchemaPublishSuccess');

  const versionsResult = await fetchVersions(
    {
      organization: org.cleanId,
      project: project.cleanId,
      target: target.cleanId,
    },
    5,
    writeToken
  );

  expect(versionsResult.body.errors).not.toBeDefined();
  expect(versionsResult.body.data!.schemaVersions.nodes).toHaveLength(1);

  const latestResult = await fetchLatestSchema(writeToken);
  expect(latestResult.body.errors).not.toBeDefined();
  expect(latestResult.body.data!.latestVersion.schemas.total).toBe(1);
  expect(latestResult.body.data!.latestVersion.schemas.nodes[0].commit).toBe('abc123');
  expect(latestResult.body.data!.latestVersion.schemas.nodes[0].source).toMatch(
    `type Query { me: User } type User @key(selectionSet: "{ id }") { id: ID! name: String }`
  );
});

test('directives should not be removed (single)', async () => {
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
    owner_access_token
  );
  expect(writeTokenResult.body.errors).not.toBeDefined();
  const writeToken = writeTokenResult.body.data!.createToken.ok!.secret;

  // Publish schema with write rights
  const publishResult = await publishSchema(
    {
      author: 'Kamil',
      commit: 'abc123',
      sdl: `directive @auth on FIELD_DEFINITION type Query { me: User @auth } type User { id: ID! name: String }`,
      service: 'test',
      url: 'https://api.com/users',
    },
    writeToken
  );

  // Schema publish should be successful
  expect(publishResult.body.errors).not.toBeDefined();
  expect(publishResult.body.data!.schemaPublish.__typename).toBe('SchemaPublishSuccess');

  const versionsResult = await fetchVersions(
    {
      organization: org.cleanId,
      project: project.cleanId,
      target: target.cleanId,
    },
    5,
    writeToken
  );

  expect(versionsResult.body.errors).not.toBeDefined();
  expect(versionsResult.body.data!.schemaVersions.nodes).toHaveLength(1);

  const latestResult = await fetchLatestSchema(writeToken);
  expect(latestResult.body.errors).not.toBeDefined();
  expect(latestResult.body.data!.latestVersion.schemas.total).toBe(1);
  expect(latestResult.body.data!.latestVersion.schemas.nodes[0].commit).toBe('abc123');
  expect(latestResult.body.data!.latestVersion.schemas.nodes[0].source).toMatch(
    `directive @auth on FIELD_DEFINITION type Query { me: User @auth } type User { id: ID! name: String }`
  );
});

test('share publication of schema using redis', async () => {
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
    owner_access_token
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
    writeToken
  );

  // Schema publish should be successful
  expect(publishResult.body.errors).not.toBeDefined();
  expect(publishResult.body.data!.schemaPublish.__typename).toBe('SchemaPublishSuccess');

  const [publishResult1, publishResult2] = await Promise.all([
    publishSchema(
      {
        sdl: `type Query { ping: String pong: String }`,
        author: 'Kamil',
        commit: 'abc234',
      },
      writeToken
    ),
    publishSchema(
      {
        sdl: `type Query { ping: String pong: String }`,
        author: 'Kamil',
        commit: 'abc234',
      },
      writeToken
    ),
  ]);
  expect(publishResult1.body.errors).not.toBeDefined();
  expect(publishResult2.body.errors).not.toBeDefined();
  expect(publishResult1.body.data!.schemaPublish.__typename).toBe('SchemaPublishSuccess');
  expect(publishResult2.body.data!.schemaPublish.__typename).toBe('SchemaPublishSuccess');
});

test("Two targets with the same commit id shouldn't return an error", async () => {
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
    owner_access_token
  );
  expect(writeTokenResult.body.errors).not.toBeDefined();
  const writeToken = writeTokenResult.body.data!.createToken.ok!.secret;
  const publishResult = await publishSchema(
    {
      author: 'gilad',
      commit: 'abc123',
      sdl: `type Query { ping: String }`,
    },
    writeToken
  );
  const createTargetResult = await createTarget(
    {
      organization: org.cleanId,
      project: project.cleanId,
      name: 'target2',
    },
    owner_access_token
  );
  const target2 = createTargetResult.body!.data!.createTarget.ok!.createdTarget;
  const writeTokenResult2 = await createToken(
    {
      name: 'test',
      organization: org.cleanId,
      project: project.cleanId,
      target: target2.cleanId,
      organizationScopes: [],
      projectScopes: [],
      targetScopes: [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
    },
    owner_access_token
  );
  const writeToken2 = writeTokenResult2.body.data!.createToken.ok!.secret;
  const publishResult2 = await publishSchema(
    {
      author: 'gilad',
      commit: 'abc123',
      sdl: `type Query { ping: String }`,
    },
    writeToken2
  );
  // Schema publish should be successful
  expect(publishResult.body.errors).not.toBeDefined();
  expect(publishResult.body.data!.schemaPublish.__typename).toBe('SchemaPublishSuccess');
  expect(publishResult2.body.errors).not.toBeDefined();
  expect(publishResult2.body.data!.schemaPublish.__typename).toBe('SchemaPublishSuccess');
});

test('marking versions as valid', async () => {
  const { access_token: owner_access_token } = await authenticate('main');
  const orgResult = await createOrganization(
    {
      name: 'foo',
    },
    owner_access_token
  );

  // Join
  const { access_token: member_access_token } = await authenticate('extra');
  const org = orgResult.body.data!.createOrganization.ok!.createdOrganizationPayload.organization;

  const invitationResult = await inviteToOrganization(
    {
      email: 'some@email.com',
      organization: org.cleanId,
    },
    owner_access_token
  );

  const inviteCode = invitationResult.body.data?.inviteToOrganizationByEmail.ok?.code;
  expect(inviteCode).toBeDefined();

  await joinOrganization(inviteCode!, member_access_token);

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
      organizationScopes: [],
      projectScopes: [],
      targetScopes: [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
    },
    owner_access_token
  );

  expect(tokenResult.body.errors).not.toBeDefined();

  const token = tokenResult.body.data!.createToken.ok!.secret;

  // Initial schema
  let result = await publishSchema(
    {
      author: 'Kamil',
      commit: 'c0',
      sdl: `type Query { ping: String }`,
    },
    token
  );

  expect(result.body.errors).not.toBeDefined();
  expect(result.body.data!.schemaPublish.__typename).toBe('SchemaPublishSuccess');

  // Second version with a forced breaking change
  result = await publishSchema(
    {
      author: 'Kamil',
      commit: 'c1',
      sdl: `type Query { pong: String }`,
      force: true,
      metadata: JSON.stringify({ c1: true }),
    },
    token
  );

  expect(result.body.errors).not.toBeDefined();

  // third version with another forced breaking change
  result = await publishSchema(
    {
      author: 'Kamil',
      commit: 'c2',
      sdl: `type Query { tennis: String }`,
      force: true,
      metadata: JSON.stringify({ c2: true }),
    },
    token
  );

  expect(result.body.errors).not.toBeDefined();

  const versionsResult = await fetchVersions(
    {
      organization: org.cleanId,
      project: project.cleanId,
      target: target.cleanId,
    },
    3,
    token
  );

  expect(versionsResult.body.errors).not.toBeDefined();
  expect(versionsResult.body.data!.schemaVersions.nodes).toHaveLength(3);

  // the initial version should be the latest valid version
  let latestValidSchemaResult = await fetchLatestValidSchema(token);
  expect(latestValidSchemaResult.body.errors).not.toBeDefined();
  expect(latestValidSchemaResult.body.data!.latestValidVersion.schemas.total).toEqual(1);
  expect(latestValidSchemaResult.body.data!.latestValidVersion.schemas.nodes[0].commit).toEqual('c0');

  const versionId = (commit: string) =>
    versionsResult.body.data!.schemaVersions.nodes.find(node => node.commit.commit === commit)!.id;

  // marking the third version as valid should promote it to be the latest valid version
  let versionStatusUpdateResult = await updateSchemaVersionStatus(
    {
      organization: org.cleanId,
      project: project.cleanId,
      target: target.cleanId,
      valid: true,
      version: versionId('c2'),
    },
    token
  );

  expect(versionStatusUpdateResult.body.errors).not.toBeDefined();
  expect(versionStatusUpdateResult.body.data!.updateSchemaVersionStatus.id).toEqual(versionId('c2'));

  latestValidSchemaResult = await fetchLatestValidSchema(token);
  expect(latestValidSchemaResult.body.errors).not.toBeDefined();
  expect(latestValidSchemaResult.body.data!.latestValidVersion.id).toEqual(versionId('c2'));

  // marking the second (not the most recent) version as valid should NOT promote it to be the latest valid version
  versionStatusUpdateResult = await updateSchemaVersionStatus(
    {
      organization: org.cleanId,
      project: project.cleanId,
      target: target.cleanId,
      valid: true,
      version: versionId('c1'),
    },
    token
  );
  expect(versionStatusUpdateResult.body.errors).not.toBeDefined();

  latestValidSchemaResult = await fetchLatestValidSchema(token);
  expect(latestValidSchemaResult.body.errors).not.toBeDefined();
  expect(latestValidSchemaResult.body.data!.latestValidVersion.id).toEqual(versionId('c2'));
});

test('marking only the most recent version as valid result in an update of CDN', async () => {
  const { access_token: owner_access_token } = await authenticate('main');
  const orgResult = await createOrganization(
    {
      name: 'foo',
    },
    owner_access_token
  );

  // Join
  const { access_token: member_access_token } = await authenticate('extra');
  const org = orgResult.body.data!.createOrganization.ok!.createdOrganizationPayload.organization;

  const invitationResult = await inviteToOrganization(
    {
      email: 'some@email.com',
      organization: org.cleanId,
    },
    owner_access_token
  );

  const inviteCode = invitationResult.body.data?.inviteToOrganizationByEmail.ok?.code;
  expect(inviteCode).toBeDefined();

  await joinOrganization(inviteCode!, member_access_token);

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
      organizationScopes: [],
      projectScopes: [],
      targetScopes: [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
    },
    owner_access_token
  );

  expect(tokenResult.body.errors).not.toBeDefined();

  const token = tokenResult.body.data!.createToken.ok!.secret;

  // Initial schema
  let result = await publishSchema(
    {
      author: 'Kamil',
      commit: 'c0',
      sdl: `type Query { ping: String }`,
      metadata: JSON.stringify({ c0: 1 }),
    },
    token
  );

  expect(result.body.errors).not.toBeDefined();
  expect(result.body.data!.schemaPublish.__typename).toBe('SchemaPublishSuccess');

  // Second version with a forced breaking change
  result = await publishSchema(
    {
      author: 'Kamil',
      commit: 'c1',
      sdl: `type Query { pong: String }`,
      force: true,
      metadata: JSON.stringify({ c1: 1 }),
    },
    token
  );

  expect(result.body.errors).not.toBeDefined();

  // third version with another forced breaking change
  result = await publishSchema(
    {
      author: 'Kamil',
      commit: 'c2',
      sdl: `type Query { tennis: String }`,
      force: true,
      metadata: JSON.stringify({ c2: 1 }),
    },
    token
  );

  expect(result.body.errors).not.toBeDefined();

  const targetSelector = {
    organization: org.cleanId,
    project: project.cleanId,
    target: target.cleanId,
  };

  // the initial version should available on CDN
  let cdnResult = await fetchSchemaFromCDN(targetSelector, token);
  expect(cdnResult.body.sdl).toContain('ping');

  let cdnMetadataResult = await fetchMetadataFromCDN(targetSelector, token);
  expect(cdnMetadataResult.status).toEqual(200);
  expect(cdnMetadataResult.body).toEqual({ c0: 1 });

  const versionsResult = await fetchVersions(targetSelector, 3, token);

  const versionId = (commit: string) =>
    versionsResult.body.data!.schemaVersions.nodes.find(node => node.commit.commit === commit)!.id;

  // marking the third version as valid should promote it to be the latest valid version and publish it to CDN
  await updateSchemaVersionStatus(
    {
      organization: org.cleanId,
      project: project.cleanId,
      target: target.cleanId,
      valid: true,
      version: versionId('c2'),
    },
    token
  );

  cdnResult = await fetchSchemaFromCDN(targetSelector, token);
  expect(cdnResult.body.sdl).toContain('tennis');

  cdnMetadataResult = await fetchMetadataFromCDN(targetSelector, token);
  expect(cdnMetadataResult.status).toEqual(200);
  expect(cdnMetadataResult.body).toEqual({ c2: 1 });

  // marking the second (not the most recent) version as valid should NOT promote it to be the latest valid version
  // const updateSchemaVersionStatusResult =
  await updateSchemaVersionStatus(
    {
      organization: org.cleanId,
      project: project.cleanId,
      target: target.cleanId,
      valid: true,
      version: versionId('c1'),
    },
    token
  );
  // console.log(JSON.stringify(updateSchemaVersionStatusResult));

  cdnResult = await fetchSchemaFromCDN(targetSelector, token);
  expect(cdnResult.body.sdl).toContain('tennis');

  cdnMetadataResult = await fetchMetadataFromCDN(targetSelector, token);
  expect(cdnMetadataResult.status).toEqual(200);
  expect(cdnMetadataResult.body).toEqual({ c2: 1 });
});

test('CDN data can not be fetched with an invalid access token', async () => {
  const { access_token: owner_access_token } = await authenticate('main');
  const orgResult = await createOrganization(
    {
      name: 'foo',
    },
    owner_access_token
  );

  // Join
  const { access_token: member_access_token } = await authenticate('extra');
  const org = orgResult.body.data!.createOrganization.ok!.createdOrganizationPayload.organization;

  const invitationResult = await inviteToOrganization(
    {
      email: 'some@email.com',
      organization: org.cleanId,
    },
    owner_access_token
  );

  const inviteCode = invitationResult.body.data?.inviteToOrganizationByEmail.ok?.code;
  expect(inviteCode).toBeDefined();

  await joinOrganization(inviteCode!, member_access_token);

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
      organizationScopes: [],
      projectScopes: [],
      targetScopes: [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
    },
    owner_access_token
  );

  expect(tokenResult.body.errors).not.toBeDefined();

  const token = tokenResult.body.data!.createToken.ok!.secret;

  // Initial schema
  const result = await publishSchema(
    {
      author: 'Kamil',
      commit: 'c0',
      sdl: `type Query { ping: String }`,
      metadata: JSON.stringify({ c0: 1 }),
    },
    token
  );

  expect(result.body.errors).not.toBeDefined();
  expect(result.body.data!.schemaPublish.__typename).toBe('SchemaPublishSuccess');

  const targetSelector = {
    organization: org.cleanId,
    project: project.cleanId,
    target: target.cleanId,
  };

  const cdnAccessResult = await createCdnAccess(targetSelector, token);

  if (cdnAccessResult.body.errors) {
    throw new Error(cdnAccessResult.body.errors[0].message);
  }

  const cdn = cdnAccessResult.body.data!.createCdnToken;

  const res = await fetch(`${cdn.url}/schema`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'X-Hive-CDN-Key': 'i-like-turtles',
    },
  });

  expect(res.status).toEqual(403);
});

test('CDN data can be fetched with an valid access token', async () => {
  const { access_token: owner_access_token } = await authenticate('main');
  const orgResult = await createOrganization(
    {
      name: 'foo',
    },
    owner_access_token
  );

  // Join
  const { access_token: member_access_token } = await authenticate('extra');
  const org = orgResult.body.data!.createOrganization.ok!.createdOrganizationPayload.organization;

  const invitationResult = await inviteToOrganization(
    {
      email: 'some@email.com',
      organization: org.cleanId,
    },
    owner_access_token
  );

  const inviteCode = invitationResult.body.data?.inviteToOrganizationByEmail.ok?.code;
  expect(inviteCode).toBeDefined();

  await joinOrganization(inviteCode!, member_access_token);

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
      organizationScopes: [],
      projectScopes: [],
      targetScopes: [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
    },
    owner_access_token
  );

  expect(tokenResult.body.errors).not.toBeDefined();

  const token = tokenResult.body.data!.createToken.ok!.secret;

  // Initial schema
  const result = await publishSchema(
    {
      author: 'Kamil',
      commit: 'c0',
      sdl: `type Query { ping: String }`,
      metadata: JSON.stringify({ c0: 1 }),
    },
    token
  );

  expect(result.body.errors).not.toBeDefined();
  expect(result.body.data!.schemaPublish.__typename).toBe('SchemaPublishSuccess');

  const targetSelector = {
    organization: org.cleanId,
    project: project.cleanId,
    target: target.cleanId,
  };

  const cdnAccessResult = await createCdnAccess(targetSelector, token);

  if (cdnAccessResult.body.errors) {
    throw new Error(cdnAccessResult.body.errors[0].message);
  }

  const cdn = cdnAccessResult.body.data!.createCdnToken;

  const cdnResult = await fetch(`${cdn.url}/schema`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'X-Hive-CDN-Key': cdn.token,
    },
  });

  expect(cdnResult.status).toEqual(200);
});

test('linkToWebsite should be available when publishing initial schema', async () => {
  const { access_token: owner_access_token } = await authenticate('main');
  const orgResult = await createOrganization(
    {
      name: 'bar',
    },
    owner_access_token
  );

  // Join
  const { access_token: member_access_token } = await authenticate('extra');
  const org = orgResult.body.data!.createOrganization.ok!.createdOrganizationPayload.organization;

  const invitationResult = await inviteToOrganization(
    {
      email: 'some@email.com',
      organization: org.cleanId,
    },
    owner_access_token
  );

  const inviteCode = invitationResult.body.data?.inviteToOrganizationByEmail.ok?.code;
  expect(inviteCode).toBeDefined();

  await joinOrganization(inviteCode!, member_access_token);

  const projectResult = await createProject(
    {
      organization: org.cleanId,
      type: ProjectType.Single,
      name: 'foo',
    },
    owner_access_token
  );

  const project = projectResult.body.data!.createProject.ok!.createdProject;
  const targets = projectResult.body.data!.createProject.ok!.createdTargets;
  const target = targets.find(t => t.name === 'development')!;

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
    owner_access_token
  );

  expect(tokenResult.body.errors).not.toBeDefined();

  const token = tokenResult.body.data!.createToken.ok!.secret;

  const result = await publishSchema(
    {
      author: 'Kamil',
      commit: 'abc123',
      sdl: `type Query { ping: String }`,
    },
    token
  );

  expect(result.body.errors).not.toBeDefined();
  expect(result.body.data!.schemaPublish.__typename).toBe('SchemaPublishSuccess');

  const linkToWebsite =
    result.body.data!.schemaPublish.__typename === 'SchemaPublishSuccess'
      ? result.body.data!.schemaPublish.linkToWebsite
      : null;

  expect(linkToWebsite).toEqual('https://app.graphql-hive.com/bar/foo/development');
});

test('linkToWebsite should be available when publishing non-initial schema', async () => {
  const { access_token: owner_access_token } = await authenticate('main');
  const orgResult = await createOrganization(
    {
      name: 'bar',
    },
    owner_access_token
  );

  // Join
  const { access_token: member_access_token } = await authenticate('extra');
  const org = orgResult.body.data!.createOrganization.ok!.createdOrganizationPayload.organization;

  const invitationResult = await inviteToOrganization(
    {
      email: 'some@email.com',
      organization: org.cleanId,
    },
    owner_access_token
  );

  const inviteCode = invitationResult.body.data?.inviteToOrganizationByEmail.ok?.code;
  expect(inviteCode).toBeDefined();

  await joinOrganization(inviteCode!, member_access_token);

  const projectResult = await createProject(
    {
      organization: org.cleanId,
      type: ProjectType.Single,
      name: 'foo',
    },
    owner_access_token
  );

  const project = projectResult.body.data!.createProject.ok!.createdProject;
  const targets = projectResult.body.data!.createProject.ok!.createdTargets;
  const target = targets.find(t => t.name === 'development')!;

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
    owner_access_token
  );

  expect(tokenResult.body.errors).not.toBeDefined();

  const token = tokenResult.body.data!.createToken.ok!.secret;

  let result = await publishSchema(
    {
      author: 'Kamil',
      commit: 'abc123',
      sdl: `type Query { ping: String }`,
    },
    token
  );

  expect(result.body.errors).not.toBeDefined();
  expect(result.body.data!.schemaPublish.__typename).toBe('SchemaPublishSuccess');

  result = await publishSchema(
    {
      author: 'Kamil',
      commit: 'abc123',
      sdl: `type Query { ping: String pong: String }`,
    },
    token
  );

  expect(result.body.errors).not.toBeDefined();
  expect(result.body.data!.schemaPublish.__typename).toBe('SchemaPublishSuccess');

  const linkToWebsite =
    result.body.data!.schemaPublish.__typename === 'SchemaPublishSuccess'
      ? result.body.data!.schemaPublish.linkToWebsite
      : null;

  expect(linkToWebsite).toMatch('https://app.graphql-hive.com/bar/foo/development/history/');
  expect(linkToWebsite).toMatch(/history\/[a-z0-9-]+$/);
});

test('cannot do API request with invalid access token', async () => {
  const orgResult = await publishSchema(
    {
      commit: '1',
      sdl: 'type Query { smokeBangBang: String }',
      author: 'Kamil',
    },
    'foobars'
  );
  expect(orgResult).toEqual({
    body: {
      data: null,
      errors: [
        {
          message: 'Invalid token provided!',
          locations: [
            {
              column: 3,
              line: 2,
            },
          ],
          path: ['schemaPublish'],
        },
      ],
    },
    status: 200,
  });
});

test('publish new schema when a field is moved from one service to another (stitching)', async () => {
  const { access_token } = await authenticate('main');
  const orgResult = await createOrganization(
    {
      name: 'foo',
    },
    access_token
  );

  const org = orgResult.body.data!.createOrganization.ok!.createdOrganizationPayload.organization;

  const projectResult = await createProject(
    {
      organization: org.cleanId,
      type: ProjectType.Stitching,
      name: 'foo',
    },
    access_token
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
    access_token
  );

  expect(tokenResult.body.errors).not.toBeDefined();

  const token = tokenResult.body.data!.createToken.ok!.secret;

  // cats service has only one field
  let result = await publishSchema(
    {
      author: 'Kamil',
      commit: 'cats',
      sdl: /* GraphQL */ `
        type Query {
          randomCat: String
        }
      `,
      service: 'cats',
    },
    token
  );

  expect(result.body.errors).not.toBeDefined();
  expect(result.body.data!.schemaPublish.__typename).toBe('SchemaPublishSuccess');

  // dogs service has two fields
  result = await publishSchema(
    {
      author: 'Kamil',
      commit: 'dogs',
      sdl: /* GraphQL */ `
        type Query {
          randomDog: String
          randomAnimal: String
        }
      `,
      service: 'dogs',
    },
    token
  );

  expect(result.body.errors).not.toBeDefined();
  expect(result.body.data!.schemaPublish.__typename).toBe('SchemaPublishSuccess');

  // cats service has now two fields, randomAnimal is borrowed from dogs service
  result = await publishSchema(
    {
      author: 'Kamil',
      commit: 'animals',
      sdl: /* GraphQL */ `
        type Query {
          randomCat: String
          randomAnimal: String
        }
      `,
      service: 'cats',
    },
    token
  );

  // We expect to have a new version, even tough the schema (merged) is the same

  expect(result.body.errors).not.toBeDefined();
  expect(result.body.data!.schemaPublish.__typename).toBe('SchemaPublishSuccess');

  const versionsResult = await fetchVersions(
    {
      organization: org.cleanId,
      project: project.cleanId,
      target: target.cleanId,
    },
    3,
    token
  );

  expect(versionsResult.body.errors).not.toBeDefined();
  expect(versionsResult.body.data!.schemaVersions.nodes).toHaveLength(3);
});

test('(experimental_acceptBreakingChanges) accept breaking changes if schema is composable', async () => {
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
      type: ProjectType.Federation,
      name: 'foo',
    },
    owner_access_token
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
    owner_access_token
  );
  expect(writeTokenResult.body.errors).not.toBeDefined();
  const writeToken = writeTokenResult.body.data!.createToken.ok!.secret;

  const basePublishParams = {
    service: 'test',
    author: 'Kamil',
    commit: 'init',
    url: 'https://api.com/users',
    sdl: `type Query { me: User } type User @key(fields: "id") { id: ID! name: String }`,
  };

  const publishResult = await publishSchema(basePublishParams, writeToken);

  // Schema publish should be successful
  expect(publishResult.body.errors).not.toBeDefined();
  expect(publishResult.body.data!.schemaPublish.__typename).toBe('SchemaPublishSuccess');

  // Publish a new version that makes the schema composable but includes a breaking change
  const composableButBreakingResult = await publishSchema(
    {
      ...basePublishParams,
      commit: 'composable-but-breaking',
      force: true,
      experimental_acceptBreakingChanges: true,
      // We changed the `@key(fields: "age")` to `@key(fields: "id")`
      // We also removed the `name` field (breaking)
      sdl: `type Query { me: User } type User @key(fields: "id") { id: ID! }`,
    },
    writeToken
  );

  const latestValid = await fetchLatestValidSchema(writeToken);

  expect(composableButBreakingResult.body.data!.schemaPublish.__typename).toBe('SchemaPublishSuccess');
  expect(latestValid.body.data?.latestValidVersion.schemas.nodes[0].commit).toBe('composable-but-breaking');
});
