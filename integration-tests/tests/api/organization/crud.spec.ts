import { createOrganization, renameOrganization } from '../../../testkit/flow';
import { authenticate } from '../../../testkit/auth';

test('renaming an organization should result changing its cleanId', async () => {
  const { access_token } = await authenticate('main');
  const orgResult = await createOrganization(
    {
      name: 'foo',
    },
    access_token
  );
  const org = orgResult.body.data!.createOrganization.ok!.createdOrganizationPayload.organization;

  const renamedOrganizationResult = await renameOrganization(
    {
      organization: org.cleanId,
      name: 'bar',
    },
    access_token
  );

  expect(renamedOrganizationResult.body.errors).not.toBeDefined();

  expect(renamedOrganizationResult.body.data?.updateOrganizationName.error).toBeNull();
  expect(
    renamedOrganizationResult.body.data?.updateOrganizationName.ok?.updatedOrganizationPayload.organization.name
  ).toBe('bar');
  expect(
    renamedOrganizationResult.body.data?.updateOrganizationName.ok?.updatedOrganizationPayload.organization.cleanId
  ).toBe('bar');
  expect(
    renamedOrganizationResult.body.data?.updateOrganizationName.ok?.updatedOrganizationPayload.selector.organization
  ).toBe('bar');
});
