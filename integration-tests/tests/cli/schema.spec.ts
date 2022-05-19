import { TargetAccessScope, ProjectType } from '@app/gql/graphql';
import { schemaPublish, schemaCheck } from '../../testkit/cli';
import { authenticate } from '../../testkit/auth';
import {
  createOrganization,
  joinOrganization,
  createProject,
  createToken,
} from '../../testkit/flow';

test('can publish and check a schema with target:registry:read access', async () => {
  const { access_token: owner_access_token } = await authenticate('main');
  const orgResult = await createOrganization(
    {
      name: 'foo',
    },
    owner_access_token
  );
  const org =
    orgResult.body.data!.createOrganization.ok.createdOrganizationPayload
      .organization;
  const code = org.inviteCode;

  // Join
  const { access_token: member_access_token } = await authenticate('extra');
  await joinOrganization(code, member_access_token);

  const projectResult = await createProject(
    {
      organization: org.cleanId,
      type: ProjectType.Single,
      name: 'foo',
    },
    owner_access_token
  );

  const project = projectResult.body.data!.createProject.ok.createdProject;
  const target = projectResult.body.data!.createProject.ok.createdTarget;

  // Create a token with write rights
  const writeTokenResult = await createToken(
    {
      name: 'test',
      organization: org.cleanId,
      project: project.cleanId,
      target: target.cleanId,
      organizationScopes: [],
      projectScopes: [],
      targetScopes: [
        TargetAccessScope.RegistryRead,
        TargetAccessScope.RegistryWrite,
      ],
    },
    owner_access_token
  );
  expect(writeTokenResult.body.errors).not.toBeDefined();
  const writeToken = writeTokenResult.body.data!.createToken.ok.secret;

  await schemaPublish([
    '--token',
    writeToken,
    '--author',
    'Kamil',
    '--commit',
    'abc123',
    'fixtures/init-schema.graphql',
  ]);

  await schemaCheck([
    '--token',
    writeToken,
    'fixtures/nonbreaking-schema.graphql',
  ]);

  await expect(
    schemaCheck(['--token', writeToken, 'fixtures/breaking-schema.graphql'])
  ).rejects.toThrowError('EXIT: 1');
});
