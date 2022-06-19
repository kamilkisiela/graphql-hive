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
} from '../../../testkit/flow';
import { authenticate } from '../../../testkit/auth';
import axios from 'axios';

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
  const code = org.inviteCode;
  await joinOrganization(code, member_access_token);

  const projectResult = await createProject(
    {
      organization: org.cleanId,
      type: ProjectType.Single,
      name: 'foo',
    },
    owner_access_token
  );

  const project = projectResult.body.data!.createProject.ok!.createdProject;
  const target = projectResult.body.data!.createProject.ok!.createdTarget;

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
  const code = org.inviteCode;
  await joinOrganization(code, member_access_token);

  const projectResult = await createProject(
    {
      organization: org.cleanId,
      type: ProjectType.Single,
      name: 'foo',
    },
    owner_access_token
  );

  const project = projectResult.body.data!.createProject.ok!.createdProject;
  const target = projectResult.body.data!.createProject.ok!.createdTarget;

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
  const target = projectResult.body.data!.createProject.ok!.createdTarget;

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
  const target = projectResult.body.data!.createProject.ok!.createdTarget;

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
  const target = projectResult.body.data!.createProject.ok!.createdTarget;

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
  const target = projectResult.body.data!.createProject.ok!.createdTarget;

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
  const target = projectResult.body.data!.createProject.ok!.createdTarget;

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
  const target = projectResult.body.data!.createProject.ok!.createdTarget;
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
  const code = org.inviteCode;
  await joinOrganization(code, member_access_token);

  const projectResult = await createProject(
    {
      organization: org.cleanId,
      type: ProjectType.Single,
      name: 'foo',
    },
    owner_access_token
  );

  const project = projectResult.body.data!.createProject.ok!.createdProject;
  const target = projectResult.body.data!.createProject.ok!.createdTarget;

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
  const code = org.inviteCode;
  await joinOrganization(code, member_access_token);

  const projectResult = await createProject(
    {
      organization: org.cleanId,
      type: ProjectType.Single,
      name: 'foo',
    },
    owner_access_token
  );

  const project = projectResult.body.data!.createProject.ok!.createdProject;
  const target = projectResult.body.data!.createProject.ok!.createdTarget;

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
  const code = org.inviteCode;
  await joinOrganization(code, member_access_token);

  const projectResult = await createProject(
    {
      organization: org.cleanId,
      type: ProjectType.Single,
      name: 'foo',
    },
    owner_access_token
  );

  const project = projectResult.body.data!.createProject.ok!.createdProject;
  const target = projectResult.body.data!.createProject.ok!.createdTarget;

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

  const cdnResult = await axios.get<{ sdl: string }>(`${cdn.url}/schema`, {
    headers: {
      'Content-Type': 'application/json',
      'X-Hive-CDN-Key': 'i-like-turtles',
    },
    responseType: 'json',
  });
  console.log(cdnResult);
  expect(cdnResult.status).toEqual(403);
});
