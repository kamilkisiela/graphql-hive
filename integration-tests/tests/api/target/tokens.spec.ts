import { TargetAccessScope, ProjectType } from '@app/gql/graphql';
import {
  createOrganization,
  joinOrganization,
  createProject,
  createToken,
  updateMemberAccess,
} from '../../../testkit/flow';
import { authenticate } from '../../../testkit/auth';

test('cannot set a scope on a token if user has no access to that scope', async () => {
  const { access_token: owner_access_token } = await authenticate('main');
  const orgResult = await createOrganization(
    {
      name: 'foo',
    },
    owner_access_token
  );

  // Join
  const { access_token: member_access_token } = await authenticate('extra');
  const org = orgResult.body.data!.createOrganization.organization;
  const code = org.inviteCode;
  const joinResult = await joinOrganization(code, member_access_token);

  const projectResult = await createProject(
    {
      organization: org.cleanId,
      type: ProjectType.Single,
      name: 'foo',
    },
    owner_access_token
  );

  if (
    joinResult.body.data!.joinOrganization.__typename !== 'OrganizationPayload'
  ) {
    throw new Error(
      `Join failed: ${joinResult.body.data!.joinOrganization.message}`
    );
  }

  const member = joinResult.body.data!.joinOrganization.organization.me;
  const project = projectResult.body.data!.createProject.createdProject;
  const target = projectResult.body.data!.createProject.createdTarget;

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
    owner_access_token
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
    member_access_token
  );

  expect(tokenResult.body.errors).toHaveLength(1);
  expect(tokenResult.body.errors![0].message).toMatch('target:registry:write');
});
