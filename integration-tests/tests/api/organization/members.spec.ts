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

test.concurrent('invited member should have basic scopes (Viewer role)', async () => {
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
  'cannot create a role with an access scope that user has no access to',
  async () => {
    const { createOrg } = await initSeed().createOwner();
    const { inviteAndJoinMember, organization } = await createOrg();
    const { createMemberRole, assignMemberRole, member } = await inviteAndJoinMember();

    // Create a role with organization:members access, so we could perform the test.
    // To create a role, user must have access to organization:members first.
    const membersManagerRole = await createMemberRole({
      organization: [OrganizationAccessScope.Members],
      project: [],
      target: [],
    });
    await assignMemberRole({
      roleId: membersManagerRole.id,
      memberId: member.id,
    });

    await expect(
      createMemberRole(
        {
          organization: [OrganizationAccessScope.Settings], // <-- this scope is not part of the membersManagerRole, so it should fail
          project: [],
          target: [],
        },
        {
          useMemberToken: true,
        },
      ),
    ).rejects.toThrowError('Missing access');
  },
);

test.concurrent(
  'cannot grant an access scope to another user if user has no access to that scope',
  async () => {
    const { createOrg } = await initSeed().createOwner();
    const { inviteAndJoinMember, organization } = await createOrg();
    const { createMemberRole, assignMemberRole, member } = await inviteAndJoinMember();
    const { member: viewerRoleMember } = await inviteAndJoinMember();

    // Create a role with organization:members access, so we could perform the test.
    // To create a role, user must have access to organization:members first.
    const membersManagerRole = await createMemberRole({
      organization: [OrganizationAccessScope.Members],
      project: [],
      target: [],
    });
    await assignMemberRole({
      roleId: membersManagerRole.id,
      memberId: member.id,
    });

    const adminRoleId = organization.memberRoles.find(r => r.name === 'Admin')?.id;

    if (!adminRoleId) {
      throw new Error('Admin role not found');
    }

    await expect(
      assignMemberRole(
        {
          roleId: adminRoleId,
          memberId: viewerRoleMember.id,
        },
        {
          useMemberToken: true,
        },
      ),
    ).rejects.toThrowError('Missing access');
  },
);

test.concurrent(
  'granting no scopes is equal to setting read-only for org, project and target',
  async () => {
    const { createOrg } = await initSeed().createOwner();
    const { inviteAndJoinMember } = await createOrg();
    const { createMemberRole } = await inviteAndJoinMember();

    const readOnlyRole = await createMemberRole({
      organization: [],
      project: [],
      target: [],
    });
    expect(readOnlyRole?.organizationAccessScopes).toHaveLength(1);
    expect(readOnlyRole?.organizationAccessScopes).toContainEqual(OrganizationAccessScope.Read);
    expect(readOnlyRole?.projectAccessScopes).toHaveLength(1);
    expect(readOnlyRole?.projectAccessScopes).toContainEqual(ProjectAccessScope.Read);
    expect(readOnlyRole?.targetAccessScopes).toHaveLength(1);
    expect(readOnlyRole?.targetAccessScopes).toContainEqual(TargetAccessScope.Read);
  },
);

test.concurrent('cannot downgrade a member when assigning a new role', async () => {
  const { createOrg } = await initSeed().createOwner();
  const { inviteAndJoinMember } = await createOrg();
  const { createMemberRole, assignMemberRole, member } = await inviteAndJoinMember();
  const { member: viewerRoleMember } = await inviteAndJoinMember();

  const managerRole = await createMemberRole({
    organization: [OrganizationAccessScope.Members],
    project: [ProjectAccessScope.Settings],
    target: [
      TargetAccessScope.RegistryRead,
      TargetAccessScope.RegistryWrite,
      TargetAccessScope.Settings,
    ],
  });
  const originalRole = await createMemberRole({
    organization: [],
    project: [],
    target: [
      TargetAccessScope.RegistryRead,
      TargetAccessScope.RegistryWrite,
      TargetAccessScope.Settings,
    ],
  });
  const roleWithLessAccess = await createMemberRole({
    organization: [],
    project: [],
    target: [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
  });
  await assignMemberRole({
    roleId: managerRole.id,
    memberId: member.id,
  });
  await assignMemberRole({
    roleId: originalRole.id,
    memberId: viewerRoleMember.id,
  });

  // non-admin member cannot downgrade another member
  await expect(
    assignMemberRole(
      {
        roleId: roleWithLessAccess.id,
        memberId: viewerRoleMember.id,
      },
      {
        useMemberToken: true,
      },
    ),
  ).rejects.toThrowError('Cannot downgrade member');
  // admin can downgrade another member
  await assignMemberRole({
    roleId: roleWithLessAccess.id,
    memberId: viewerRoleMember.id,
  });
});

test.concurrent('cannot downgrade a member when modifying a role', async () => {
  const { createOrg } = await initSeed().createOwner();
  const { inviteAndJoinMember } = await createOrg();
  const { createMemberRole, assignMemberRole, member, updateMemberRole } =
    await inviteAndJoinMember();
  const { member: viewerRoleMember } = await inviteAndJoinMember();

  const managerRole = await createMemberRole({
    organization: [OrganizationAccessScope.Members],
    project: [ProjectAccessScope.Settings],
    target: [
      TargetAccessScope.RegistryRead,
      TargetAccessScope.RegistryWrite,
      TargetAccessScope.Settings,
    ],
  });
  const roleToBeUpdated = await createMemberRole({
    organization: [],
    project: [],
    target: [
      TargetAccessScope.RegistryRead,
      TargetAccessScope.RegistryWrite,
      TargetAccessScope.Settings,
    ],
  });
  await assignMemberRole({
    roleId: managerRole.id,
    memberId: member.id,
  });
  await assignMemberRole({
    roleId: roleToBeUpdated.id,
    memberId: viewerRoleMember.id,
  });

  // non-admin member cannot downgrade another member
  await expect(
    updateMemberRole(
      roleToBeUpdated,
      {
        organization: [],
        project: [],
        target: [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite], // <-- downgrade (missing: TargetAccessScope.Settings)
      },
      {
        useMemberToken: true,
      },
    ),
  ).rejects.toThrowError('Cannot downgrade member');
  // admin can downgrade another member
  await updateMemberRole(roleToBeUpdated, {
    organization: [],
    project: [],
    target: [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite], // <-- downgrade (missing: TargetAccessScope.Settings)
  });
});

test.concurrent('cannot delete a role with members', async () => {
  const { createOrg } = await initSeed().createOwner();
  const { inviteAndJoinMember } = await createOrg();
  const { createMemberRole, deleteMemberRole, assignMemberRole, member } =
    await inviteAndJoinMember();
  const { member: viewerRoleMember } = await inviteAndJoinMember();

  const membersManagerRole = await createMemberRole({
    organization: [OrganizationAccessScope.Members],
    project: [],
    target: [],
  });
  const readOnlyRole = await createMemberRole({
    organization: [],
    project: [],
    target: [],
  });
  await assignMemberRole({
    roleId: membersManagerRole.id,
    memberId: member.id,
  });
  await assignMemberRole({
    roleId: readOnlyRole.id,
    memberId: viewerRoleMember.id,
  });

  // delete the role as the owner
  await expect(deleteMemberRole(readOnlyRole.id)).rejects.toThrowError(
    'Cannot delete a role with members',
  );
  // delete the role as a member with enough access to delete the role
  await expect(
    deleteMemberRole(readOnlyRole.id, {
      useMemberToken: true,
    }),
  ).rejects.toThrowError('Cannot delete a role with members');
});

test.concurrent('cannot invite a member with more access than the inviter', async () => {
  const seed = initSeed();
  const { createOrg } = await seed.createOwner();
  const { inviteMember, inviteAndJoinMember, organization } = await createOrg();
  const {
    member: invitingMember,
    memberToken: invitingMemberToken,
    createMemberRole,
    assignMemberRole,
  } = await inviteAndJoinMember();

  const adminRoleId = organization.memberRoles.find(r => r.name === 'Admin')?.id;
  if (!adminRoleId) {
    throw new Error('Admin role not found');
  }

  const membersManagerRole = await createMemberRole({
    organization: [OrganizationAccessScope.Members],
    project: [],
    target: [],
  });
  const readOnlyRole = await createMemberRole({
    organization: [],
    project: [],
    target: [],
  });

  // give the inviting member a role with enough access to invite other members
  await assignMemberRole({
    roleId: membersManagerRole.id,
    memberId: invitingMember.id,
  });

  const inviteEmail = seed.generateEmail();
  const failedInvitationResult = await inviteMember(inviteEmail, invitingMemberToken, adminRoleId);
  expect(failedInvitationResult.error?.message).toEqual(
    expect.stringContaining('Not enough access to invite a member'),
  );

  const invitationResult = await inviteMember(inviteEmail, invitingMemberToken, readOnlyRole.id);
  const inviteCode = invitationResult.ok?.code;
  expect(inviteCode).toBeDefined();
});

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
