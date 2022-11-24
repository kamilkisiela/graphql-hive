import { OrganizationAccessScope, ProjectAccessScope, TargetAccessScope } from '@app/gql/graphql';
import {
  createOrganization,
  inviteToOrganization,
  joinOrganization,
  updateMemberAccess,
} from '../../../testkit/flow';
import { authenticate } from '../../../testkit/auth';
import { history } from '../../../testkit/emails';

test('owner of an organization should have all scopes', async () => {
  const { access_token } = await authenticate('main');
  const result = await createOrganization(
    {
      name: 'foo',
    },
    access_token,
  );

  expect(result.body.errors).not.toBeDefined();

  const owner =
    result.body.data!.createOrganization.ok!.createdOrganizationPayload.organization.owner;

  Object.values(OrganizationAccessScope).forEach(scope => {
    expect(owner.organizationAccessScopes).toContain(scope);
  });

  Object.values(ProjectAccessScope).forEach(scope => {
    expect(owner.projectAccessScopes).toContain(scope);
  });

  Object.values(TargetAccessScope).forEach(scope => {
    expect(owner.targetAccessScopes).toContain(scope);
  });
});

test('regular member of an organization should have basic scopes', async () => {
  const { access_token: owner_access_token } = await authenticate('main');
  const orgResult = await createOrganization(
    {
      name: 'foo',
    },
    owner_access_token,
  );

  const org = orgResult.body.data!.createOrganization.ok!.createdOrganizationPayload.organization;

  // Invite
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
  const joinResult = await joinOrganization(inviteCode!, member_access_token);

  expect(joinResult.body.errors).not.toBeDefined();
  expect(joinResult.body.data?.joinOrganization.__typename).toBe('OrganizationPayload');

  if (joinResult.body.data!.joinOrganization.__typename !== 'OrganizationPayload') {
    throw new Error('Join failed');
  }

  const member = joinResult.body.data!.joinOrganization.organization.me;

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

test('cannot grant an access scope to another user if user has no access to that scope', async () => {
  const { access_token: owner_access_token } = await authenticate('main');
  const orgResult = await createOrganization(
    {
      name: 'foo',
    },
    owner_access_token,
  );

  const org = orgResult.body.data!.createOrganization.ok!.createdOrganizationPayload.organization;

  // Join
  const invitationResult = await inviteToOrganization(
    {
      email: 'some@email.com',
      organization: org.cleanId,
    },
    owner_access_token,
  );

  const inviteCode = invitationResult.body.data?.inviteToOrganizationByEmail.ok?.code;
  expect(inviteCode).toBeDefined();

  const { access_token: member_access_token } = await authenticate('extra');

  const joinResult = await joinOrganization(inviteCode!, member_access_token);

  if (joinResult.body.data!.joinOrganization.__typename !== 'OrganizationPayload') {
    throw new Error(`Join failed: ${joinResult.body.data!.joinOrganization.message}`);
  }

  const member = joinResult.body.data!.joinOrganization.organization.me;

  // Grant organization:members access
  await updateMemberAccess(
    {
      organization: org.cleanId,
      organizationScopes: [OrganizationAccessScope.Members],
      projectScopes: [],
      targetScopes: [],
      user: member.id,
    },
    owner_access_token,
  );

  // Grant access to target:tokens:write
  const accessResult = await updateMemberAccess(
    {
      organization: org.cleanId,
      organizationScopes: [],
      projectScopes: [],
      targetScopes: [TargetAccessScope.TokensWrite],
      user: member.id,
    },
    member_access_token,
  );

  expect(accessResult.body.errors).toHaveLength(1);
  expect(accessResult.body.errors![0].message).toMatch('target:tokens:write');
});

test('granting no scopes is equal to setting read-only for org, project and target', async () => {
  const { access_token: owner_access_token } = await authenticate('main');
  const orgResult = await createOrganization(
    {
      name: 'foo',
    },
    owner_access_token,
  );

  const org = orgResult.body.data!.createOrganization.ok!.createdOrganizationPayload.organization;

  // Join
  const invitationResult = await inviteToOrganization(
    {
      email: 'some@email.com',
      organization: org.cleanId,
    },
    owner_access_token,
  );

  const inviteCode = invitationResult.body.data?.inviteToOrganizationByEmail.ok?.code;
  expect(inviteCode).toBeDefined();

  const { access_token: member_access_token } = await authenticate('extra');

  const joinResult = await joinOrganization(inviteCode!, member_access_token);

  if (joinResult.body.data!.joinOrganization.__typename !== 'OrganizationPayload') {
    throw new Error(`Join failed: ${joinResult.body.data!.joinOrganization.message}`);
  }

  const member = joinResult.body.data!.joinOrganization.organization.me;

  // Grant access to target:tokens:write
  const accessResult = await updateMemberAccess(
    {
      organization: org.cleanId,
      organizationScopes: [],
      projectScopes: [],
      targetScopes: [],
      user: member.id,
    },
    owner_access_token,
  );

  expect(accessResult.body.errors).not.toBeDefined();

  const memberWithAccess =
    accessResult.body.data?.updateOrganizationMemberAccess.organization.members.nodes.find(
      m => m.id === member.id,
    );
  expect(memberWithAccess?.organizationAccessScopes).toHaveLength(1);
  expect(memberWithAccess?.organizationAccessScopes).toContainEqual(OrganizationAccessScope.Read);
  expect(memberWithAccess?.projectAccessScopes).toHaveLength(1);
  expect(memberWithAccess?.projectAccessScopes).toContainEqual(ProjectAccessScope.Read);
  expect(memberWithAccess?.targetAccessScopes).toHaveLength(1);
  expect(memberWithAccess?.targetAccessScopes).toContainEqual(TargetAccessScope.Read);
});

test('email invitation', async () => {
  const { access_token: owner_access_token } = await authenticate('main');
  const createOrgResult = await createOrganization(
    {
      name: 'foo',
    },
    owner_access_token,
  );
  const org =
    createOrgResult.body.data!.createOrganization.ok!.createdOrganizationPayload.organization;

  // Invite
  const email = 'invited@invited.com';
  const invitationResult = await inviteToOrganization(
    {
      email,
      organization: org.cleanId,
    },
    owner_access_token,
  );

  const inviteCode = invitationResult.body.data?.inviteToOrganizationByEmail.ok?.code;
  expect(inviteCode).toBeDefined();

  const sentEmails = await history();
  expect(sentEmails).toContainEqual(expect.objectContaining({ to: email }));
});

test('cannot join organization twice using the same invitation code', async () => {
  const { access_token: owner_access_token } = await authenticate('main');
  const createOrgResult = await createOrganization(
    {
      name: 'foo',
    },
    owner_access_token,
  );
  const org =
    createOrgResult.body.data!.createOrganization.ok!.createdOrganizationPayload.organization;

  // Invite
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
  const joinResult = await joinOrganization(inviteCode!, member_access_token);

  expect(joinResult.body.errors).not.toBeDefined();
  expect(joinResult.body.data?.joinOrganization.__typename).toBe('OrganizationPayload');

  if (joinResult.body.data!.joinOrganization.__typename !== 'OrganizationPayload') {
    throw new Error('Join failed');
  }

  const { access_token: another_access_token } = await authenticate('admin');
  const secondJoinResult = await joinOrganization(inviteCode!, another_access_token);
  expect(secondJoinResult.body.data?.joinOrganization.__typename).toBe(
    'OrganizationInvitationError',
  );
});
