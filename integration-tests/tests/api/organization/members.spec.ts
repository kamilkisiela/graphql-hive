import {
  OrganizationAccessScope,
  ProjectAccessScope,
  TargetAccessScope,
} from '@app/gql/graphql';
import {
  createOrganization,
  joinOrganization,
  updateMemberAccess,
} from '../../../testkit/flow';
import { authenticate } from '../../../testkit/auth';

test('owner of an organization should have all scopes', async () => {
  const { access_token } = await authenticate('main');
  const result = await createOrganization(
    {
      name: 'foo',
    },
    access_token
  );

  expect(result.body.errors).not.toBeDefined();

  const owner =
    result.body.data!.createOrganization.ok.createdOrganizationPayload
      .organization.owner;

  Object.values(OrganizationAccessScope).forEach((scope) => {
    expect(owner.organizationAccessScopes).toContain(scope);
  });

  Object.values(ProjectAccessScope).forEach((scope) => {
    expect(owner.projectAccessScopes).toContain(scope);
  });

  Object.values(TargetAccessScope).forEach((scope) => {
    expect(owner.targetAccessScopes).toContain(scope);
  });
});

test('regular member of an organization should have basic scopes', async () => {
  const { access_token: owner_access_token } = await authenticate('main');
  const orgResult = await createOrganization(
    {
      name: 'foo',
    },
    owner_access_token
  );

  // Join
  const { access_token: member_access_token } = await authenticate('extra');
  const code =
    orgResult.body.data!.createOrganization.ok.createdOrganizationPayload
      .organization.inviteCode;
  const joinResult = await joinOrganization(code, member_access_token);

  expect(joinResult.body.errors).not.toBeDefined();
  expect(joinResult.body.data?.joinOrganization.__typename).toBe(
    'OrganizationPayload'
  );

  if (
    joinResult.body.data!.joinOrganization.__typename !== 'OrganizationPayload'
  ) {
    throw new Error('Join failed');
  }

  const member = joinResult.body.data!.joinOrganization.organization.me;

  // Should have only organization:read access
  expect(member.organizationAccessScopes).toContainEqual(
    OrganizationAccessScope.Read
  );
  // Nothing more
  expect(member.organizationAccessScopes).toHaveLength(1);

  // Should have only project:read and project:operations-store:read access
  expect(member.projectAccessScopes).toContainEqual(ProjectAccessScope.Read);
  expect(member.projectAccessScopes).toContainEqual(
    ProjectAccessScope.OperationsStoreRead
  );
  // Nothing more
  expect(member.projectAccessScopes).toHaveLength(2);

  // Should have only target:read and target:registry:read access
  expect(member.targetAccessScopes).toContainEqual(TargetAccessScope.Read);
  expect(member.targetAccessScopes).toContainEqual(
    TargetAccessScope.RegistryRead
  );
  // Nothing more
  expect(member.targetAccessScopes).toHaveLength(2);
});

test('cannot grant an access scope to another user if user has no access to that scope', async () => {
  const { access_token: owner_access_token } = await authenticate('main');
  const orgResult = await createOrganization(
    {
      name: 'foo',
    },
    owner_access_token
  );

  // Join
  const { access_token: member_access_token } = await authenticate('extra');
  const org =
    orgResult.body.data!.createOrganization.ok.createdOrganizationPayload
      .organization;
  const code = org.inviteCode;
  const joinResult = await joinOrganization(code, member_access_token);

  if (
    joinResult.body.data!.joinOrganization.__typename !== 'OrganizationPayload'
  ) {
    throw new Error(
      `Join failed: ${joinResult.body.data!.joinOrganization.message}`
    );
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
    owner_access_token
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
    member_access_token
  );

  expect(accessResult.body.errors).toHaveLength(1);
  expect(accessResult.body.errors![0].message).toMatch('target:tokens:write');
});
