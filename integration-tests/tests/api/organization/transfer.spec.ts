import {
  createOrganization,
  getOrganizationTransferRequest,
  getOrganizationMembers,
  inviteToOrganization,
  joinOrganization,
  requestOrganizationTransfer,
  answerOrganizationTransferRequest,
} from '../../../testkit/flow';
import { authenticate, userEmails } from '../../../testkit/auth';
import {
  OrganizationAccessScope,
  ProjectAccessScope,
  TargetAccessScope,
} from '../../../testkit/gql/graphql';

async function prepareOrganization() {
  const accessTokens = {
    owner: (await authenticate('main')).access_token,
    member: (await authenticate('extra')).access_token,
    lonelyMember: (await authenticate('lonely')).access_token,
    nonMember: (await authenticate('foo')).access_token,
  };

  const orgResult = await createOrganization(
    {
      name: 'foo',
    },
    accessTokens.owner,
  );

  const organization =
    orgResult.body.data!.createOrganization.ok!.createdOrganizationPayload.organization;

  async function join(email: string, accessToken: string) {
    const invitationResult = await inviteToOrganization(
      {
        organization: organization.cleanId,
        email,
      },
      accessTokens.owner,
    );

    const code = invitationResult.body.data?.inviteToOrganizationByEmail.ok?.code;

    if (!code) {
      throw new Error('Could not create invitation');
    }

    const joinResult = await joinOrganization(code, accessToken);

    if (joinResult.body.data?.joinOrganization.__typename !== 'OrganizationPayload') {
      throw new Error('Could not join organization');
    }
  }

  await join(userEmails['extra'], accessTokens.member);
  await join(userEmails['lonely'], accessTokens.lonelyMember);

  const membersResult = await getOrganizationMembers(
    { organization: organization.cleanId },
    accessTokens.owner,
  );

  const members = membersResult.body.data?.organization?.organization.members.nodes;

  if (!members) {
    throw new Error('Could not get organization members');
  }

  return {
    organization,
    accessTokens,
    owner: members.find(m => m.user.email === userEmails['main'])!,
    member: members.find(m => m.user.email === userEmails['extra'])!,
    lonelyMember: members.find(m => m.user.email === userEmails['lonely'])!,
  };
}

test('accessing non-existing ownership transfer request should result in null', async () => {
  const { organization, accessTokens } = await prepareOrganization();

  const transferRequestResult = await getOrganizationTransferRequest(
    {
      organization: organization.cleanId,
      code: 'non-existing-code',
    },
    accessTokens.owner,
  );

  expect(transferRequestResult.body.errors).not.toBeDefined();
  expect(transferRequestResult.body.data?.organizationTransferRequest).toBeNull();
});

test('owner should be able to request the ownership transfer to a member', async () => {
  const { organization, accessTokens, member } = await prepareOrganization();

  const transferRequestResult = await requestOrganizationTransfer(
    {
      organization: organization.cleanId,
      user: member.id,
    },
    accessTokens.owner,
  );

  expect(transferRequestResult.body.errors).not.toBeDefined();
  expect(transferRequestResult.body.data?.requestOrganizationTransfer.ok?.email).toBe(
    member.user.email,
  );
});

test('non-owner should not be able to request the ownership transfer', async () => {
  const { organization, accessTokens, owner } = await prepareOrganization();

  const transferRequestResult = await requestOrganizationTransfer(
    {
      organization: organization.cleanId,
      user: owner.id,
    },
    accessTokens.member,
  );

  expect(transferRequestResult.body.data).toBeNull();
  expect(transferRequestResult.body.errors).toBeDefined();
});

test('owner should not be able to request the ownership transfer to non-member', async () => {
  const { organization, accessTokens, member } = await prepareOrganization();

  const transferRequestResult = await requestOrganizationTransfer(
    {
      organization: organization.cleanId,
      user: member.id,
    },
    accessTokens.member,
  );

  expect(transferRequestResult.body.errors).not.toBeDefined();
  expect(
    transferRequestResult.body.data?.requestOrganizationTransfer?.error?.message,
  ).toBeDefined();
});

test('non-member should not be able to access the transfer request', async () => {
  const { organization, accessTokens, member } = await prepareOrganization();

  const requestTransferResult = await requestOrganizationTransfer(
    {
      organization: organization.cleanId,
      user: member.id,
    },
    accessTokens.owner,
  );

  const code = requestTransferResult.body.data?.requestOrganizationTransfer.ok?.code;

  if (!code) {
    throw new Error('Could not create transfer request');
  }

  const requestResult = await getOrganizationTransferRequest(
    {
      organization: organization.cleanId,
      code,
    },
    accessTokens.nonMember,
  );

  expect(requestResult.body.errors).toBeDefined();
  expect(requestResult.body.data?.organizationTransferRequest).toBeNull();
});

test('non-recipient should not be able to access the transfer request', async () => {
  const { organization, accessTokens, member } = await prepareOrganization();

  const requestTransferResult = await requestOrganizationTransfer(
    {
      organization: organization.cleanId,
      user: member.id,
    },
    accessTokens.owner,
  );

  const code = requestTransferResult.body.data?.requestOrganizationTransfer.ok?.code;

  if (!code) {
    throw new Error('Could not create transfer request');
  }

  const requestResult = await getOrganizationTransferRequest(
    {
      organization: organization.cleanId,
      code,
    },
    accessTokens.lonelyMember,
  );

  expect(requestResult.body.errors).not.toBeDefined();
  expect(requestResult.body.data?.organizationTransferRequest).toBeNull();
});

test('recipient should be able to access the transfer request', async () => {
  const { organization, accessTokens, member } = await prepareOrganization();

  const requestTransferResult = await requestOrganizationTransfer(
    {
      organization: organization.cleanId,
      user: member.id,
    },
    accessTokens.owner,
  );

  const code = requestTransferResult.body.data?.requestOrganizationTransfer.ok?.code;

  if (!code) {
    throw new Error('Could not create transfer request');
  }

  const requestResult = await getOrganizationTransferRequest(
    {
      organization: organization.cleanId,
      code,
    },
    accessTokens.member,
  );

  expect(requestResult.body.errors).not.toBeDefined();
  expect(requestResult.body.data?.organizationTransferRequest).not.toBeNull();
});

test('recipient should be able to answer the ownership transfer', async () => {
  const { organization, accessTokens, member } = await prepareOrganization();

  const requestTransferResult = await requestOrganizationTransfer(
    {
      organization: organization.cleanId,
      user: member.id,
    },
    accessTokens.owner,
  );

  const code = requestTransferResult.body.data?.requestOrganizationTransfer.ok?.code;

  if (!code) {
    throw new Error('Could not create transfer request');
  }

  const answerResult = await answerOrganizationTransferRequest(
    {
      organization: organization.cleanId,
      code,
      accept: true,
    },
    accessTokens.member,
  );

  expect(answerResult.body.errors).not.toBeDefined();
  expect(answerResult.body.data?.answerOrganizationTransferRequest.ok?.accepted).toBe(true);
});

test('non-member should not be able to answer the ownership transfer', async () => {
  const { organization, accessTokens, member } = await prepareOrganization();

  const requestTransferResult = await requestOrganizationTransfer(
    {
      organization: organization.cleanId,
      user: member.id,
    },
    accessTokens.owner,
  );

  const code = requestTransferResult.body.data?.requestOrganizationTransfer.ok?.code;

  if (!code) {
    throw new Error('Could not create transfer request');
  }

  const answerResult = await answerOrganizationTransferRequest(
    {
      organization: organization.cleanId,
      code,
      accept: true,
    },
    accessTokens.lonelyMember,
  );

  expect(answerResult.body.errors).not.toBeDefined();
  expect(answerResult.body.data?.answerOrganizationTransferRequest.error?.message).toBeDefined();
});

test('owner should not be able to answer the ownership transfer', async () => {
  const { organization, accessTokens, member } = await prepareOrganization();

  const requestTransferResult = await requestOrganizationTransfer(
    {
      organization: organization.cleanId,
      user: member.id,
    },
    accessTokens.owner,
  );

  const code = requestTransferResult.body.data?.requestOrganizationTransfer.ok?.code;

  if (!code) {
    throw new Error('Could not create transfer request');
  }

  const answerResult = await answerOrganizationTransferRequest(
    {
      organization: organization.cleanId,
      code,
      accept: true,
    },
    accessTokens.owner,
  );

  expect(answerResult.body.errors).not.toBeDefined();
  expect(answerResult.body.data?.answerOrganizationTransferRequest.error?.message).toBeDefined();
});

test('non-member should not be able to answer the ownership transfer', async () => {
  const { organization, accessTokens, member } = await prepareOrganization();

  const requestTransferResult = await requestOrganizationTransfer(
    {
      organization: organization.cleanId,
      user: member.id,
    },
    accessTokens.owner,
  );

  const code = requestTransferResult.body.data?.requestOrganizationTransfer.ok?.code;

  if (!code) {
    throw new Error('Could not create transfer request');
  }

  const answerResult = await answerOrganizationTransferRequest(
    {
      organization: organization.cleanId,
      code,
      accept: true,
    },
    accessTokens.nonMember,
  );

  expect(answerResult.body.errors).not.toBeDefined();
  expect(answerResult.body.data?.answerOrganizationTransferRequest.error?.message).toBeDefined();
});

test('previous owner should keep the ownership until the new owner accepts the transfer', async () => {
  const { organization, accessTokens, member, owner } = await prepareOrganization();

  const requestTransferResult = await requestOrganizationTransfer(
    {
      organization: organization.cleanId,
      user: member.id,
    },
    accessTokens.owner,
  );

  const code = requestTransferResult.body.data?.requestOrganizationTransfer.ok?.code;

  if (!code) {
    throw new Error('Could not create transfer request');
  }

  const membersResult = await getOrganizationMembers(
    {
      organization: organization.cleanId,
    },
    accessTokens.owner,
  );

  const members = membersResult.body.data?.organization?.organization.members.nodes;

  if (!members) {
    throw new Error('Could not get members');
  }

  // current owner
  expect(members.find(m => m.id === owner.id)).toEqual(
    expect.objectContaining({
      organizationAccessScopes: owner.organizationAccessScopes,
      projectAccessScopes: owner.projectAccessScopes,
      targetAccessScopes: owner.targetAccessScopes,
    }),
  );

  // potential new owner
  expect(members.find(m => m.id === member.id)).toEqual(
    expect.objectContaining({
      organizationAccessScopes: member.organizationAccessScopes,
      projectAccessScopes: member.projectAccessScopes,
      targetAccessScopes: member.targetAccessScopes,
    }),
  );
});

test('previous owner should lose only "delete" rights, new owner should get all access', async () => {
  const { organization, accessTokens, member, owner, lonelyMember } = await prepareOrganization();

  const requestTransferResult = await requestOrganizationTransfer(
    {
      organization: organization.cleanId,
      user: member.id,
    },
    accessTokens.owner,
  );

  const code = requestTransferResult.body.data?.requestOrganizationTransfer.ok?.code;

  if (!code) {
    throw new Error('Could not create transfer request');
  }

  const answerResult = await answerOrganizationTransferRequest(
    {
      organization: organization.cleanId,
      code,
      accept: true,
    },
    accessTokens.member,
  );

  expect(answerResult.body.errors).not.toBeDefined();
  expect(answerResult.body.data?.answerOrganizationTransferRequest.ok?.accepted).toBe(true);

  const membersResult = await getOrganizationMembers(
    {
      organization: organization.cleanId,
    },
    accessTokens.owner,
  );

  const members = membersResult.body.data?.organization?.organization.members.nodes;

  if (!members) {
    throw new Error('Could not get members');
  }

  // previous owner should lose only "delete" rights
  expect(members.find(m => m.id === owner.id)).toEqual(
    expect.objectContaining({
      organizationAccessScopes: owner.organizationAccessScopes.filter(
        s => s !== OrganizationAccessScope.Delete,
      ),
      projectAccessScopes: owner.projectAccessScopes.filter(s => s !== ProjectAccessScope.Delete),
      targetAccessScopes: owner.targetAccessScopes.filter(s => s !== TargetAccessScope.Delete),
    }),
  );

  // new owner should get all access
  expect(members.find(m => m.id === member.id)).toEqual(
    expect.objectContaining({
      organizationAccessScopes: owner.organizationAccessScopes,
      projectAccessScopes: owner.projectAccessScopes,
      targetAccessScopes: owner.targetAccessScopes,
    }),
  );

  // other members should not be affected
  expect(members.find(m => m.id === lonelyMember.id)).toEqual(
    expect.objectContaining({
      organizationAccessScopes: lonelyMember.organizationAccessScopes,
      projectAccessScopes: lonelyMember.projectAccessScopes,
      targetAccessScopes: lonelyMember.targetAccessScopes,
    }),
  );
});
