import { TargetAccessScope, ProjectType } from '@app/gql/graphql';
import { createHash } from 'node:crypto';
import { schemaPublish, schemaCheck } from '../../testkit/cli';
import { authenticate } from '../../testkit/auth';
import {
  createOrganization,
  joinOrganization,
  createProject,
  createToken,
  fetchSupergraphFromCDN,
  inviteToOrganization,
} from '../../testkit/flow';

test('can publish and check a schema with target:registry:read access', async () => {
  const { access_token: owner_access_token } = await authenticate('main');
  const orgResult = await createOrganization(
    {
      name: 'foo',
    },
    owner_access_token
  );
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

  // Join
  const { access_token: member_access_token } = await authenticate('extra');
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

  await schemaPublish([
    '--token',
    writeToken,
    '--author',
    'Kamil',
    '--commit',
    'abc123',
    'fixtures/init-schema.graphql',
  ]);

  await schemaCheck(['--token', writeToken, 'fixtures/nonbreaking-schema.graphql']);

  await expect(schemaCheck(['--token', writeToken, 'fixtures/breaking-schema.graphql'])).rejects.toThrowError(
    /breaking/
  );
});

test('publishing invalid schema SDL provides meaningful feedback for the user.', async () => {
  const { access_token: owner_access_token } = await authenticate('main');
  const orgResult = await createOrganization(
    {
      name: 'foo',
    },
    owner_access_token
  );
  const org = orgResult.body.data!.createOrganization.ok!.createdOrganizationPayload.organization;

  const invitationResult = await inviteToOrganization(
    {
      email: 'some@email.com',
      organization: org.cleanId,
    },
    owner_access_token
  );

  const code = invitationResult.body.data?.inviteToOrganizationByEmail.ok?.code;
  expect(code).toBeDefined();

  // Join
  const { access_token: member_access_token } = await authenticate('extra');
  await joinOrganization(code!, member_access_token);

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

  const allocatedError = new Error('Should have thrown.');
  try {
    await schemaPublish([
      '--token',
      writeToken,
      '--author',
      'Kamil',
      '--commit',
      'abc123',
      'fixtures/init-invalid-schema.graphql',
    ]);
    throw allocatedError;
  } catch (err) {
    if (err === allocatedError) {
      throw err;
    }
    expect(String(err)).toMatch(`The SDL is not valid at line 1, column 1:`);
    expect(String(err)).toMatch(`Syntax Error: Unexpected Name "iliketurtles"`);
  }
});

test('service url should be available in supergraph', async () => {
  const { access_token: owner_access_token } = await authenticate('main');
  const orgResult = await createOrganization(
    {
      name: 'foo',
    },
    owner_access_token
  );
  const org = orgResult.body.data!.createOrganization.ok!.createdOrganizationPayload.organization;

  const invitationResult = await inviteToOrganization(
    {
      email: 'some@email.com',
      organization: org.cleanId,
    },
    owner_access_token
  );

  const code = invitationResult.body.data?.inviteToOrganizationByEmail.ok?.code;
  expect(code).toBeDefined();

  // Join
  const { access_token: member_access_token } = await authenticate('extra');
  await joinOrganization(code!, member_access_token);

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

  await schemaPublish([
    '--token',
    writeToken,
    '--author',
    'Kamil',
    '--commit',
    'abc123',
    '--service',
    'users',
    '--url',
    'https://api.com/users-subgraph',
    'fixtures/federation-init.graphql',
  ]);

  const supergraph = await fetchSupergraphFromCDN(
    {
      organization: org.cleanId,
      project: project.cleanId,
      target: target.cleanId,
    },
    writeToken
  );

  expect(supergraph.body).toMatch('(name: "users" url: "https://api.com/users-subgraph")');
});

test('service url should be required in Federation', async () => {
  const { access_token: owner_access_token } = await authenticate('main');
  const orgResult = await createOrganization(
    {
      name: 'foo',
    },
    owner_access_token
  );
  const org = orgResult.body.data!.createOrganization.ok!.createdOrganizationPayload.organization;

  const invitationResult = await inviteToOrganization(
    {
      email: 'some@email.com',
      organization: org.cleanId,
    },
    owner_access_token
  );

  const code = invitationResult.body.data?.inviteToOrganizationByEmail.ok?.code;
  expect(code).toBeDefined();

  // Join
  const { access_token: member_access_token } = await authenticate('extra');
  await joinOrganization(code!, member_access_token);

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

  await expect(
    schemaPublish([
      '--token',
      writeToken,
      '--author',
      'Kamil',
      '--commit',
      'abc123',
      '--service',
      'users',
      'fixtures/federation-init.graphql',
    ])
  ).rejects.toThrowError(/url/);
});

test('schema:publish should print a link to the website', async () => {
  const { access_token: owner_access_token } = await authenticate('main');
  const orgResult = await createOrganization(
    {
      name: 'foo',
    },
    owner_access_token
  );
  const org = orgResult.body.data!.createOrganization.ok!.createdOrganizationPayload.organization;

  const invitationResult = await inviteToOrganization(
    {
      email: 'some@email.com',
      organization: org.cleanId,
    },
    owner_access_token
  );

  const code = invitationResult.body.data?.inviteToOrganizationByEmail.ok?.code;
  expect(code).toBeDefined();

  // Join
  const { access_token: member_access_token } = await authenticate('extra');
  await joinOrganization(code!, member_access_token);

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

  await expect(schemaPublish(['--token', writeToken, 'fixtures/init-schema.graphql'])).resolves.toMatch(
    'Available at https://app.graphql-hive.com/foo/foo/development'
  );

  await expect(schemaPublish(['--token', writeToken, 'fixtures/nonbreaking-schema.graphql'])).resolves.toMatch(
    'Available at https://app.graphql-hive.com/foo/foo/development/history/'
  );
});

test('schema:check should notify user when registry is empty', async () => {
  const { access_token: owner_access_token } = await authenticate('main');
  const orgResult = await createOrganization(
    {
      name: 'foo',
    },
    owner_access_token
  );
  const org = orgResult.body.data!.createOrganization.ok!.createdOrganizationPayload.organization;

  const invitationResult = await inviteToOrganization(
    {
      email: 'some@email.com',
      organization: org.cleanId,
    },
    owner_access_token
  );

  const code = invitationResult.body.data?.inviteToOrganizationByEmail.ok?.code;
  expect(code).toBeDefined();

  // Join
  const { access_token: member_access_token } = await authenticate('extra');
  await joinOrganization(code!, member_access_token);

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

  await expect(schemaCheck(['--token', writeToken, 'fixtures/init-schema.graphql'])).resolves.toMatch('empty');
});

test('schema:check should throw on corrupted schema', async () => {
  const { access_token: owner_access_token } = await authenticate('main');
  const orgResult = await createOrganization(
    {
      name: 'foo',
    },
    owner_access_token
  );
  const org = orgResult.body.data!.createOrganization.ok!.createdOrganizationPayload.organization;

  const invitationResult = await inviteToOrganization(
    {
      email: 'some@email.com',
      organization: org.cleanId,
    },
    owner_access_token
  );

  const code = invitationResult.body.data?.inviteToOrganizationByEmail.ok?.code;
  expect(code).toBeDefined();

  // Join
  const { access_token: member_access_token } = await authenticate('extra');
  await joinOrganization(code!, member_access_token);

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

  const output = schemaCheck(['--token', writeToken, 'fixtures/missing-type.graphql']);

  await expect(output).rejects.toThrowError('Unknown type');
});

test('schema:publish should see Invalid Token error when token is invalid', async () => {
  const { access_token: owner_access_token } = await authenticate('main');
  const orgResult = await createOrganization(
    {
      name: 'foo',
    },
    owner_access_token
  );
  const org = orgResult.body.data!.createOrganization.ok!.createdOrganizationPayload.organization;

  await createProject(
    {
      organization: org.cleanId,
      type: ProjectType.Single,
      name: 'foo',
    },
    owner_access_token
  );

  const token = createHash('md5').update('nope').digest('hex').substring(0, 31);

  const output = schemaPublish(['--token', token, 'fixtures/init-schema.graphql']);

  await expect(output).rejects.toThrowError('Invalid token provided');
});
