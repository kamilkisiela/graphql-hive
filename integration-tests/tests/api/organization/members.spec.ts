import { OrganizationAccessScope, ProjectAccessScope, TargetAccessScope } from '@app/gql/graphql';
import { history } from '../../../testkit/emails';
import { initSeed } from '../../../testkit/seed';

test.concurrent('owner of an organization should have all scopes', async () => {
  const { createOrg } = await initSeed().createOwner();
  const { organization } = await createOrg();

  Object.values(OrganizationAccessScope).forEach(scope => {
    expect(organization.owner.organizationAccessScopes).toContain(scope);
  });

  Object.values(ProjectAccessScope).forEach(scope => {
    expect(organization.owner.projectAccessScopes).toContain(scope);
  });

  Object.values(TargetAccessScope).forEach(scope => {
    expect(organization.owner.targetAccessScopes).toContain(scope);
  });
});

test.concurrent('regular member of an organization should have basic scopes', async () => {
  const { createOrg } = await initSeed().createOwner();
  const { inviteAndJoinMember } = await createOrg();
  const { member } = await inviteAndJoinMember();

  // Should have only organization:read access
  expect(member.organizationAccessScopes).toContainEqual(OrganizationAccessScope.Read);
  // Nothing more
  expect(member.organizationAccessScopes).toHaveLength(1);
  // Should have only project:read and project:operations-store:read access
  expect(member.projectAccessScopes).toContainEqual(ProjectAccessScope.Read);
  expect(member.projectAccessScopes).toContainEqual(ProjectAccessScope.OperationsStoreRead);
  // Nothing more
  expect(member.projectAccessScopes).toHaveLength(2);
  // Should have only target:read and target:registry:read access
  expect(member.targetAccessScopes).toContainEqual(TargetAccessScope.Read);
  expect(member.targetAccessScopes).toContainEqual(TargetAccessScope.RegistryRead);
  // Nothing more
  expect(member.targetAccessScopes).toHaveLength(2);
});

test.concurrent(
  'cannot grant an access scope to another user if user has no access to that scope',
  async () => {
    const { createOrg } = await initSeed().createOwner();
    const { inviteAndJoinMember } = await createOrg();
    const { updateMemberAccess } = await inviteAndJoinMember();

    // Grant organization: members access
    await updateMemberAccess([], [], [OrganizationAccessScope.Members]);

    // Grant access to target:tokens:write
    await expect(
      updateMemberAccess([TargetAccessScope.TokensWrite], [], [], { useMemberToken: true }),
    ).rejects.toThrowError('target:tokens:write');
  },
);

test.concurrent(
  'granting no scopes is equal to setting read-only for org, project and target',
  async () => {
    const { createOrg } = await initSeed().createOwner();
    const { inviteAndJoinMember } = await createOrg();
    const { member, updateMemberAccess } = await inviteAndJoinMember();

    const accessResult = await updateMemberAccess([], [], []);
    const memberWithAccess = accessResult.members.nodes.find(m => m.id === member.id);
    expect(memberWithAccess?.organizationAccessScopes).toHaveLength(1);
    expect(memberWithAccess?.organizationAccessScopes).toContainEqual(OrganizationAccessScope.Read);
    expect(memberWithAccess?.projectAccessScopes).toHaveLength(1);
    expect(memberWithAccess?.projectAccessScopes).toContainEqual(ProjectAccessScope.Read);
    expect(memberWithAccess?.targetAccessScopes).toHaveLength(1);
    expect(memberWithAccess?.targetAccessScopes).toContainEqual(TargetAccessScope.Read);
  },
);

test.concurrent('email invitation', async () => {
  const seed = initSeed();
  const { createOrg } = await seed.createOwner();
  const { inviteMember } = await createOrg();

  const inviteEmail = seed.generateEmail();
  const invitationResult = await inviteMember(inviteEmail);
  const inviteCode = invitationResult.ok?.code;
  expect(inviteCode).toBeDefined();

  const sentEmails = await history();
  expect(sentEmails).toContainEqual(expect.objectContaining({ to: inviteEmail }));
});

test.concurrent('cannot join organization twice using the same invitation code', async () => {
  const seed = initSeed();
  const { createOrg } = await seed.createOwner();
  const { inviteMember, joinMemberUsingCode } = await createOrg();

  // Invite
  const invitationResult = await inviteMember();
  const inviteCode = invitationResult.ok!.code;
  expect(inviteCode).toBeDefined();

  // Join
  const extra = seed.generateEmail();
  const { access_token: member_access_token } = await seed.authenticate(extra);
  const joinResult = await (
    await joinMemberUsingCode(inviteCode, member_access_token)
  ).expectNoGraphQLErrors();

  expect(joinResult.joinOrganization.__typename).toBe('OrganizationPayload');

  if (joinResult.joinOrganization.__typename !== 'OrganizationPayload') {
    throw new Error('Join failed');
  }

  const other = seed.generateEmail();
  const { access_token: other_access_token } = await seed.authenticate(other);
  const otherJoinResult = await (
    await joinMemberUsingCode(inviteCode, other_access_token)
  ).expectNoGraphQLErrors();
  expect(otherJoinResult.joinOrganization.__typename).toBe('OrganizationInvitationError');
});
