import { renameOrganization } from '../../../testkit/flow';
import { initSeed } from '../../../testkit/seed';

test.concurrent('renaming an organization should result changing its cleanId', async () => {
  const { ownerToken, createOrg } = await initSeed().createOwner();
  const { organization } = await createOrg();

  const renamedOrganizationResult = await renameOrganization(
    {
      organization: organization.cleanId,
      name: 'bar',
    },
    ownerToken,
  ).then(r => r.expectNoGraphQLErrors());

  expect(renamedOrganizationResult.updateOrganizationName.error).toBeNull();
  expect(
    renamedOrganizationResult.updateOrganizationName.ok?.updatedOrganizationPayload.organization
      .name,
  ).toBe('bar');
  expect(
    renamedOrganizationResult.updateOrganizationName.ok?.updatedOrganizationPayload.organization
      .cleanId,
  ).toBe('bar');
  expect(
    renamedOrganizationResult.updateOrganizationName.ok?.updatedOrganizationPayload.selector
      .organization,
  ).toBe('bar');
});
