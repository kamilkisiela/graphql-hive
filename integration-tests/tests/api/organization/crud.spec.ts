import { randomUUID } from 'node:crypto';
import { changeOrganizationSlug, renameOrganization } from '../../../testkit/flow';
import { initSeed } from '../../../testkit/seed';

test.concurrent('renaming an organization should NOT affect its cleanId', async () => {
  const { ownerToken, createOrg } = await initSeed().createOwner();
  const { organization } = await createOrg();

  const newName = randomUUID();
  const renamedOrganizationResult = await renameOrganization(
    {
      organization: organization.cleanId,
      name: newName,
    },
    ownerToken,
  ).then(r => r.expectNoGraphQLErrors());

  const result = renamedOrganizationResult.updateOrganizationName.ok?.updatedOrganizationPayload;
  expect(renamedOrganizationResult.updateOrganizationName.error).toBeNull();
  expect(result?.organization.name).toBe(newName);
  expect(result?.organization.cleanId).toEqual(organization.cleanId);
  expect(result?.selector.organization).toEqual(organization.cleanId);
});

test.concurrent('renaming an organization to the same name should be possible', async () => {
  const { ownerToken, createOrg } = await initSeed().createOwner();
  const { organization } = await createOrg();

  const renamedOrganizationResult = await renameOrganization(
    {
      organization: organization.cleanId,
      name: organization.name,
    },
    ownerToken,
  ).then(r => r.expectNoGraphQLErrors());

  const result = renamedOrganizationResult.updateOrganizationName.ok?.updatedOrganizationPayload;
  expect(renamedOrganizationResult.updateOrganizationName.error).toBeNull();
  expect(result?.organization.name).toBe(organization.name);
  expect(result?.organization.cleanId).toEqual(organization.cleanId);
  expect(result?.selector.organization).toEqual(organization.cleanId);
});

test.concurrent(
  'modifying a clean id of an organization to the same value should not change the clean id',
  async () => {
    const { ownerToken, createOrg } = await initSeed().createOwner();
    const { organization } = await createOrg();

    const changeOrganizationSlugResult = await changeOrganizationSlug(
      {
        organization: organization.cleanId,
        slug: organization.cleanId,
      },
      ownerToken,
    ).then(r => r.expectNoGraphQLErrors());

    const result =
      changeOrganizationSlugResult.updateOrganizationSlug.ok?.updatedOrganizationPayload;
    expect(changeOrganizationSlugResult.updateOrganizationSlug.error).toBeNull();
    expect(result?.organization.name).toBe(organization.name);
    expect(result?.organization.cleanId).toEqual(organization.cleanId);
    expect(result?.selector.organization).toEqual(organization.cleanId);
  },
);

test.concurrent('modifying a clean id of an organization should be possible', async () => {
  const { ownerToken, createOrg } = await initSeed().createOwner();
  const { organization } = await createOrg();

  const newCleanId = randomUUID();
  const changeOrganizationSlugResult = await changeOrganizationSlug(
    {
      organization: organization.cleanId,
      slug: newCleanId,
    },
    ownerToken,
  ).then(r => r.expectNoGraphQLErrors());

  const result = changeOrganizationSlugResult.updateOrganizationSlug.ok?.updatedOrganizationPayload;
  expect(changeOrganizationSlugResult.updateOrganizationSlug.error).toBeNull();
  expect(result?.organization.name).toBe(organization.name);
  expect(result?.organization.cleanId).toEqual(newCleanId);
  expect(result?.selector.organization).toEqual(newCleanId);
});

test.concurrent(
  'modifying a clean id of an organization to a reserved keyword should fail',
  async () => {
    const { ownerToken, createOrg } = await initSeed().createOwner();
    const { organization } = await createOrg();

    const newCleanId = 'graphql';
    const changeOrganizationSlugResult = await changeOrganizationSlug(
      {
        organization: organization.cleanId,
        slug: newCleanId,
      },
      ownerToken,
    ).then(r => r.expectNoGraphQLErrors());

    expect(changeOrganizationSlugResult.updateOrganizationSlug.ok).toBeNull();
    expect(changeOrganizationSlugResult.updateOrganizationSlug.error?.message).not.toBeNull();
  },
);

test.concurrent(
  'modifying a clean id of an organization to a taken clean id should fail',
  async () => {
    const { ownerToken, createOrg } = await initSeed().createOwner();
    const { organization } = await createOrg();
    const { organization: anotherOrganization } = await createOrg();

    const changeOrganizationSlugResult = await changeOrganizationSlug(
      {
        organization: organization.cleanId,
        slug: anotherOrganization.cleanId,
      },
      ownerToken,
    ).then(r => r.expectNoGraphQLErrors());

    expect(changeOrganizationSlugResult.updateOrganizationSlug.ok).toBeNull();
    expect(changeOrganizationSlugResult.updateOrganizationSlug.error?.message).not.toBeNull();
  },
);
