import { TargetAccessScope, ProjectType } from '@app/gql/graphql';
import {
  createOrganization,
  joinOrganization,
  createProject,
  createToken,
  updateMemberAccess,
  inviteToOrganization,
  readTokenInfo,
} from '../../../testkit/flow';
import { authenticate } from '../../../testkit/auth';

test('setting no scopes equals to readonly for organization, project, target', async () => {
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

  // member should not have access to target:registry:write
  const tokenResult = await createToken(
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

  expect(tokenResult.body.errors).not.toBeDefined();
  const secret = tokenResult.body.data?.createToken.ok?.secret;
  expect(secret).toBeDefined();

  const tokenInfoResult = await readTokenInfo(secret!);
  expect(tokenInfoResult.body.errors).not.toBeDefined();

  if (tokenInfoResult.body.data?.tokenInfo.__typename === 'TokenNotFoundError') {
    throw new Error('Token not found');
  }

  const tokenInfo = tokenInfoResult.body.data?.tokenInfo;
  // organization
  expect(tokenInfo?.hasOrganizationRead).toBe(true);
  expect(tokenInfo?.hasOrganizationDelete).toBe(false);
  expect(tokenInfo?.hasOrganizationIntegrations).toBe(false);
  expect(tokenInfo?.hasOrganizationMembers).toBe(false);
  expect(tokenInfo?.hasOrganizationSettings).toBe(false);
  // project
  expect(tokenInfo?.hasProjectRead).toBe(true);
  expect(tokenInfo?.hasProjectDelete).toBe(false);
  expect(tokenInfo?.hasProjectAlerts).toBe(false);
  expect(tokenInfo?.hasProjectOperationsStoreRead).toBe(false);
  expect(tokenInfo?.hasProjectOperationsStoreWrite).toBe(false);
  expect(tokenInfo?.hasProjectSettings).toBe(false);
  // target
  expect(tokenInfo?.hasTargetRead).toBe(true);
  expect(tokenInfo?.hasTargetDelete).toBe(false);
  expect(tokenInfo?.hasTargetSettings).toBe(false);
  expect(tokenInfo?.hasTargetRegistryRead).toBe(false);
  expect(tokenInfo?.hasTargetRegistryWrite).toBe(false);
  expect(tokenInfo?.hasTargetTokensRead).toBe(false);
  expect(tokenInfo?.hasTargetTokensWrite).toBe(false);
});

test('cannot set a scope on a token if user has no access to that scope', async () => {
  const { access_token: owner_access_token } = await authenticate('main');
  const orgResult = await createOrganization(
    {
      name: 'foo',
    },
    owner_access_token,
  );

  // Join
  const { access_token: member_access_token } = await authenticate('extra');
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

  const joinResult = await joinOrganization(inviteCode!, member_access_token);

  const projectResult = await createProject(
    {
      organization: org.cleanId,
      type: ProjectType.Single,
      name: 'foo',
    },
    owner_access_token,
  );

  if (joinResult.body.data!.joinOrganization.__typename !== 'OrganizationPayload') {
    throw new Error(`Join failed: ${joinResult.body.data!.joinOrganization.message}`);
  }

  const member = joinResult.body.data!.joinOrganization.organization.me;
  const project = projectResult.body.data!.createProject.ok!.createdProject;
  const target = projectResult.body.data!.createProject.ok!.createdTargets[0];

  // Give access to tokens
  await updateMemberAccess(
    {
      organization: org.cleanId,
      organizationScopes: [],
      projectScopes: [],
      targetScopes: [
        TargetAccessScope.Read,
        TargetAccessScope.RegistryRead,
        TargetAccessScope.TokensRead,
        TargetAccessScope.TokensWrite,
      ],
      user: member.id,
    },
    owner_access_token,
  );

  // member should not have access to target:registry:write
  const tokenResult = await createToken(
    {
      name: 'test',
      organization: org.cleanId,
      project: project.cleanId,
      target: target.cleanId,
      organizationScopes: [],
      projectScopes: [],
      targetScopes: [TargetAccessScope.RegistryWrite],
    },
    member_access_token,
  );

  expect(tokenResult.body.errors).toHaveLength(1);
  expect(tokenResult.body.errors![0].message).toMatch('target:registry:write');
});
