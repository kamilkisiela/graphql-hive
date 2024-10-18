import {
  OrganizationAccessScope,
  ProjectAccessScope,
  TargetAccessScope,
} from 'testkit/gql/graphql';
import {
  answerOrganizationTransferRequest,
  getOrganizationTransferRequest,
  requestOrganizationTransfer,
} from '../../../testkit/flow';
import { initSeed } from '../../../testkit/seed';

test.concurrent(
  'accessing non-existing ownership transfer request should result in null',
  async ({ expect }) => {
    const { createOrg, ownerToken } = await initSeed().createOwner();
    const { organization } = await createOrg();

    const transferRequestResult = await getOrganizationTransferRequest(
      {
        organizationSlug: organization.slug,
        code: 'non-existing-code',
      },
      ownerToken,
    ).then(r => r.expectNoGraphQLErrors());

    expect(transferRequestResult.organizationTransferRequest).toBeNull();
  },
);

test.concurrent(
  'owner should be able to request the ownership transfer to a member',
  async ({ expect }) => {
    const { createOrg, ownerToken } = await initSeed().createOwner();
    const { organization, inviteAndJoinMember } = await createOrg();
    const { member, memberEmail } = await inviteAndJoinMember();

    const transferRequestResult = await requestOrganizationTransfer(
      {
        organizationSlug: organization.slug,
        userId: member.user.id,
      },
      ownerToken,
    ).then(r => r.expectNoGraphQLErrors());

    expect(transferRequestResult.requestOrganizationTransfer.ok?.email).toBe(memberEmail);
  },
);

test.concurrent(
  'non-owner should not be able to request the ownership transfer',
  async ({ expect }) => {
    const { createOrg, ownerEmail } = await initSeed().createOwner();
    const { organization, inviteAndJoinMember, members } = await createOrg();
    const { memberToken } = await inviteAndJoinMember();
    const orgMembers = await members();

    const errors = await requestOrganizationTransfer(
      {
        organizationSlug: organization.slug,
        userId: orgMembers.find(u => u.user.email === ownerEmail)!.user.id,
      },
      memberToken,
    ).then(r => r.expectGraphQLErrors());

    expect(errors).toBeDefined();
    expect(errors.length).toBe(1);
  },
);

test.concurrent(
  'owner should not be able to request the ownership transfer to non-member',
  async ({ expect }) => {
    const { createOrg } = await initSeed().createOwner();
    const { organization, inviteAndJoinMember } = await createOrg();
    const { memberToken, member } = await inviteAndJoinMember();

    const transferRequestResult = await requestOrganizationTransfer(
      {
        organizationSlug: organization.slug,
        userId: member.user.id,
      },
      memberToken,
    ).then(r => r.expectNoGraphQLErrors());

    expect(transferRequestResult.requestOrganizationTransfer?.error?.message).toBeDefined();
  },
);

test.concurrent(
  'non-member should not be able to access the transfer request',
  async ({ expect }) => {
    const { createOrg, ownerToken } = await initSeed().createOwner();
    const { organization, inviteAndJoinMember } = await createOrg();
    const { member } = await inviteAndJoinMember();

    const requestTransferResult = await requestOrganizationTransfer(
      {
        organizationSlug: organization.slug,
        userId: member.user.id,
      },
      ownerToken,
    ).then(r => r.expectNoGraphQLErrors());

    const code = requestTransferResult.requestOrganizationTransfer.ok?.code;

    if (!code) {
      throw new Error('Could not create transfer request');
    }

    const { ownerToken: nonMemberToken } = await initSeed().createOwner();

    const errors = await getOrganizationTransferRequest(
      {
        organizationSlug: organization.slug,
        code,
      },
      nonMemberToken,
    ).then(r => r.expectGraphQLErrors());

    expect(errors).toBeDefined();
    expect(errors.length).toBe(1);
  },
);

test.concurrent(
  'non-recipient should not be able to access the transfer request',
  async ({ expect }) => {
    const { createOrg, ownerToken } = await initSeed().createOwner();
    const { organization, inviteAndJoinMember } = await createOrg();
    const { member } = await inviteAndJoinMember();
    const { memberToken: lonelyMemberToken } = await inviteAndJoinMember();

    const requestTransferResult = await requestOrganizationTransfer(
      {
        organizationSlug: organization.slug,
        userId: member.user.id,
      },
      ownerToken,
    ).then(r => r.expectNoGraphQLErrors());

    const code = requestTransferResult.requestOrganizationTransfer.ok?.code;

    if (!code) {
      throw new Error('Could not create transfer request');
    }

    const requestResult = await getOrganizationTransferRequest(
      {
        organizationSlug: organization.slug,
        code,
      },
      lonelyMemberToken,
    ).then(r => r.expectNoGraphQLErrors());

    expect(requestResult.organizationTransferRequest).toBeNull();
  },
);

test.concurrent('recipient should be able to access the transfer request', async ({ expect }) => {
  const { createOrg, ownerToken } = await initSeed().createOwner();
  const { organization, inviteAndJoinMember } = await createOrg();
  const { member, memberToken } = await inviteAndJoinMember();
  const requestTransferResult = await requestOrganizationTransfer(
    {
      organizationSlug: organization.slug,
      userId: member.user.id,
    },
    ownerToken,
  ).then(r => r.expectNoGraphQLErrors());

  const code = requestTransferResult.requestOrganizationTransfer.ok?.code;

  if (!code) {
    throw new Error('Could not create transfer request');
  }

  const requestResult = await getOrganizationTransferRequest(
    {
      organizationSlug: organization.slug,
      code,
    },
    memberToken,
  ).then(r => r.expectNoGraphQLErrors());

  expect(requestResult.organizationTransferRequest).not.toBeNull();
});

test.concurrent('recipient should be able to answer the ownership transfer', async ({ expect }) => {
  const { createOrg, ownerToken } = await initSeed().createOwner();
  const { organization, inviteAndJoinMember } = await createOrg();
  const { member, memberToken } = await inviteAndJoinMember();

  const requestTransferResult = await requestOrganizationTransfer(
    {
      organizationSlug: organization.slug,
      userId: member.user.id,
    },
    ownerToken,
  ).then(r => r.expectNoGraphQLErrors());

  const code = requestTransferResult.requestOrganizationTransfer.ok?.code;

  if (!code) {
    throw new Error('Could not create transfer request');
  }

  const answerResult = await answerOrganizationTransferRequest(
    {
      organizationSlug: organization.slug,
      code,
      accept: true,
    },
    memberToken,
  ).then(r => r.expectNoGraphQLErrors());

  expect(answerResult.answerOrganizationTransferRequest.ok?.accepted).toBe(true);
});

test.concurrent(
  'non-member should not be able to answer the ownership transfer',
  async ({ expect }) => {
    const { createOrg, ownerToken } = await initSeed().createOwner();
    const { organization, inviteAndJoinMember } = await createOrg();
    const { member } = await inviteAndJoinMember();
    const { memberToken: lonelyMemberToken } = await inviteAndJoinMember();

    const requestTransferResult = await requestOrganizationTransfer(
      {
        organizationSlug: organization.slug,
        userId: member.user.id,
      },
      ownerToken,
    ).then(r => r.expectNoGraphQLErrors());

    const code = requestTransferResult.requestOrganizationTransfer.ok?.code;

    if (!code) {
      throw new Error('Could not create transfer request');
    }

    const answerResult = await answerOrganizationTransferRequest(
      {
        organizationSlug: organization.slug,
        code,
        accept: true,
      },
      lonelyMemberToken,
    ).then(r => r.expectNoGraphQLErrors());

    expect(answerResult.answerOrganizationTransferRequest.error?.message).toBeDefined();
  },
);

test.concurrent('owner should not be able to answer the ownership transfer', async ({ expect }) => {
  const { createOrg, ownerToken } = await initSeed().createOwner();
  const { organization, inviteAndJoinMember } = await createOrg();
  const { member } = await inviteAndJoinMember();

  const requestTransferResult = await requestOrganizationTransfer(
    {
      organizationSlug: organization.slug,
      userId: member.user.id,
    },
    ownerToken,
  ).then(r => r.expectNoGraphQLErrors());

  const code = requestTransferResult.requestOrganizationTransfer.ok?.code;

  if (!code) {
    throw new Error('Could not create transfer request');
  }

  const answerResult = await answerOrganizationTransferRequest(
    {
      organizationSlug: organization.slug,
      code,
      accept: true,
    },
    ownerToken,
  ).then(r => r.expectNoGraphQLErrors());

  expect(answerResult.answerOrganizationTransferRequest.error?.message).toBeDefined();
});

test.concurrent(
  'non-member should not be able to answer the ownership transfer',
  async ({ expect }) => {
    const { createOrg, ownerToken } = await initSeed().createOwner();
    const { organization, inviteAndJoinMember } = await createOrg();
    const { member } = await inviteAndJoinMember();

    const requestTransferResult = await requestOrganizationTransfer(
      {
        organizationSlug: organization.slug,
        userId: member.user.id,
      },
      ownerToken,
    ).then(r => r.expectNoGraphQLErrors());

    const code = requestTransferResult.requestOrganizationTransfer.ok?.code;

    if (!code) {
      throw new Error('Could not create transfer request');
    }

    const { ownerToken: nonMemberToken } = await initSeed().createOwner();
    const answerResult = await answerOrganizationTransferRequest(
      {
        organizationSlug: organization.slug,
        code,
        accept: true,
      },
      nonMemberToken,
    ).then(r => r.expectNoGraphQLErrors());

    expect(answerResult.answerOrganizationTransferRequest.error?.message).toBeDefined();
  },
);

test.concurrent(
  'previous owner should keep the ownership until the new owner accepts the transfer',
  async ({ expect }) => {
    const { createOrg, ownerToken, ownerEmail } = await initSeed().createOwner();
    const { organization, inviteAndJoinMember, members } = await createOrg();
    const { member } = await inviteAndJoinMember();

    const requestTransferResult = await requestOrganizationTransfer(
      {
        organizationSlug: organization.slug,
        userId: member.user.id,
      },
      ownerToken,
    ).then(r => r.expectNoGraphQLErrors());

    const code = requestTransferResult.requestOrganizationTransfer.ok?.code;

    if (!code) {
      throw new Error('Could not create transfer request');
    }

    const orgMembers = await members();

    if (!orgMembers) {
      throw new Error('Could not get members');
    }

    // current owner
    const owner = orgMembers.find(m => m.user.email === ownerEmail)!;
    expect(orgMembers.find(m => m.id === owner.id)).toEqual(
      expect.objectContaining({
        organizationAccessScopes: owner.organizationAccessScopes,
        projectAccessScopes: owner.projectAccessScopes,
        targetAccessScopes: owner.targetAccessScopes,
      }),
    );

    // potential new owner
    expect(orgMembers.find(m => m.id === member.id)).toEqual(
      expect.objectContaining({
        organizationAccessScopes: member.organizationAccessScopes,
        projectAccessScopes: member.projectAccessScopes,
        targetAccessScopes: member.targetAccessScopes,
      }),
    );
  },
);

test.concurrent(
  'previous owner should have an Admin role, new owner should get an Admin role as well',
  async ({ expect }) => {
    const { createOrg, ownerToken, ownerEmail } = await initSeed().createOwner();
    const { organization, inviteAndJoinMember, members } = await createOrg();
    const { member, memberToken } = await inviteAndJoinMember();
    const { member: lonelyMember } = await inviteAndJoinMember();

    const requestTransferResult = await requestOrganizationTransfer(
      {
        organizationSlug: organization.slug,
        userId: member.user.id,
      },
      ownerToken,
    ).then(r => r.expectNoGraphQLErrors());

    const code = requestTransferResult.requestOrganizationTransfer.ok?.code;

    if (!code) {
      throw new Error('Could not create transfer request');
    }

    const answerResult = await answerOrganizationTransferRequest(
      {
        organizationSlug: organization.slug,
        code,
        accept: true,
      },
      memberToken,
    ).then(r => r.expectNoGraphQLErrors());

    expect(answerResult.answerOrganizationTransferRequest.ok?.accepted).toBe(true);

    const orgMembers = await members();

    if (!orgMembers) {
      throw new Error('Could not get members');
    }

    const previousOwner = orgMembers.find(m => m.user.email === ownerEmail)!;
    const owner = orgMembers.find(m => m.id === member.id)!;

    expect(owner.role?.name).toBe('Admin');
    expect(previousOwner.role?.name).toBe('Admin');

    // other members should not be affected
    expect(orgMembers.find(m => m.id === lonelyMember.id)).toEqual(
      expect.objectContaining({
        organizationAccessScopes: lonelyMember.organizationAccessScopes,
        projectAccessScopes: lonelyMember.projectAccessScopes,
        targetAccessScopes: lonelyMember.targetAccessScopes,
      }),
    );
  },
);
