import { randomUUID } from 'node:crypto';
import { renameOrganization } from '../../../testkit/flow';
import { initSeed } from '../../../testkit/seed';

test.concurrent('renaming an organization should result changing its cleanId', async () => {
  const { ownerToken, createOrg } = await initSeed().createOwner();
  const { organization } = await createOrg();

  const name = randomUUID();
  const partialCleanId = name.split('-')[0];
  const renamedOrganizationResult = await renameOrganization(
    {
      organization: organization.cleanId,
      name,
    },
    ownerToken,
  ).then(r => r.expectNoGraphQLErrors());

  expect(renamedOrganizationResult.updateOrganizationName.error).toBeNull();
  expect(
    renamedOrganizationResult.updateOrganizationName.ok?.updatedOrganizationPayload.organization
      .name,
  ).toBe(name);
  expect(
    renamedOrganizationResult.updateOrganizationName.ok?.updatedOrganizationPayload.organization
      .cleanId,
  ).toEqual(expect.stringContaining(partialCleanId));
  expect(
    renamedOrganizationResult.updateOrganizationName.ok?.updatedOrganizationPayload.selector
      .organization,
  ).toEqual(expect.stringContaining(partialCleanId));
});
