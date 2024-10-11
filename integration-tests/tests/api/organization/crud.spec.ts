import { randomUUID } from 'node:crypto';
import { updateOrganizationSlug } from '../../../testkit/flow';
import { initSeed } from '../../../testkit/seed';

test.concurrent(
  'modifying a slug of an organization to the same value should not change the slug',
  async ({ expect }) => {
    const { ownerToken, createOrg } = await initSeed().createOwner();
    const { organization } = await createOrg();

    const changeOrganizationSlugResult = await updateOrganizationSlug(
      {
        organization: organization.cleanId,
        slug: organization.cleanId,
      },
      ownerToken,
    ).then(r => r.expectNoGraphQLErrors());

    const result =
      changeOrganizationSlugResult.updateOrganizationSlug.ok?.updatedOrganizationPayload;
    expect(changeOrganizationSlugResult.updateOrganizationSlug.error).toBeNull();
    expect(result?.organization.name).toBe(organization.cleanId);
    expect(result?.organization.cleanId).toEqual(organization.cleanId);
    expect(result?.selector.organization).toEqual(organization.cleanId);
  },
);

test.concurrent(
  'modifying a clean id of an organization should be possible',
  async ({ expect }) => {
    const { ownerToken, createOrg } = await initSeed().createOwner();
    const { organization } = await createOrg();

    const newCleanId = randomUUID();
    const changeOrganizationSlugResult = await updateOrganizationSlug(
      {
        organization: organization.cleanId,
        slug: newCleanId,
      },
      ownerToken,
    ).then(r => r.expectNoGraphQLErrors());

    const result =
      changeOrganizationSlugResult.updateOrganizationSlug.ok?.updatedOrganizationPayload;
    expect(changeOrganizationSlugResult.updateOrganizationSlug.error).toBeNull();
    expect(result?.organization.name).toBe(newCleanId);
    expect(result?.organization.cleanId).toEqual(newCleanId);
    expect(result?.selector.organization).toEqual(newCleanId);
  },
);

test.concurrent(
  'modifying a clean id of an organization should change the organization name',
  async ({ expect }) => {
    const { ownerToken, createOrg } = await initSeed().createOwner();
    const { organization } = await createOrg();

    const newCleanId = randomUUID();
    const changeOrganizationSlugResult = await updateOrganizationSlug(
      {
        organization: organization.cleanId,
        slug: newCleanId,
      },
      ownerToken,
    ).then(r => r.expectNoGraphQLErrors());

    const result =
      changeOrganizationSlugResult.updateOrganizationSlug.ok?.updatedOrganizationPayload;
    expect(changeOrganizationSlugResult.updateOrganizationSlug.error).toBeNull();
    // We keep the organization name the same as the clean id (slug)
    // We do it for legacy reasons, as some queries still use the name.
    expect(result?.organization.name).toBe(newCleanId);
    expect(result?.organization.cleanId).toEqual(newCleanId);
    expect(result?.selector.organization).toEqual(newCleanId);
  },
);

test.concurrent(
  'modifying a clean id of an organization to a reserved keyword should fail',
  async ({ expect }) => {
    const { ownerToken, createOrg } = await initSeed().createOwner();
    const { organization } = await createOrg();

    const newCleanId = 'graphql';
    const changeOrganizationSlugResult = await updateOrganizationSlug(
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
  async ({ expect }) => {
    const { ownerToken, createOrg } = await initSeed().createOwner();
    const { organization } = await createOrg();
    const { organization: anotherOrganization } = await createOrg();

    const changeOrganizationSlugResult = await updateOrganizationSlug(
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
