import { createOrganization, getOrganizationTransferRequest } from '../../../testkit/flow';
import { authenticate } from '../../../testkit/auth';

test('accessing non-existing ownership transfer request should result in null', async () => {
  // We need it to be null because we use it in the frontend to determine if the transfer request exists.
  const { access_token } = await authenticate('main');
  const orgResult = await createOrganization(
    {
      name: 'foo',
    },
    access_token,
  );

  const org = orgResult.body.data!.createOrganization.ok!.createdOrganizationPayload.organization;

  const transferRequestResult = await getOrganizationTransferRequest(
    {
      organization: org.cleanId,
      code: 'non-existing-code',
    },
    access_token,
  );

  expect(transferRequestResult.body.errors).not.toBeDefined();
  expect(transferRequestResult.body.data?.organizationTransferRequest).toBeNull();
});

test.todo('non-owner should not be able to request the ownership transfer');
test.todo('owner should not be able to request the ownership transfer to non-member');
test.todo('owner should be able to request the ownership transfer to a member');

test.todo('non-member should not be able to access the transfer request');
test.todo('non-recipient should not be able to access the transfer request');
test.todo('recipient should be able to access the transfer request');

test.todo('recipient should be able to answer the ownership transfer');
test.todo('non-member should not be able to answer the ownership transfer');
test.todo('owner should not be able to answer the ownership transfer');

test.todo('previous owner should keep the ownership until the new owner accepts the transfer');
test.todo('previous owner should lose only "delete" rights');
test.todo('new owner should have all the rights');
