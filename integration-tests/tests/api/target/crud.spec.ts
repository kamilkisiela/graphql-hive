import { ProjectType } from 'testkit/gql/graphql';
import { updateTargetSlug } from '../../../testkit/flow';
import { initSeed } from '../../../testkit/seed';

test.concurrent(`changing a target's slug should result changing its name`, async ({ expect }) => {
  const { createOrg, ownerToken } = await initSeed().createOwner();
  const { createProject, organization } = await createOrg();
  const { project, target } = await createProject(ProjectType.Single);

  const renameResult = await updateTargetSlug(
    {
      organization: organization.cleanId,
      project: project.cleanId,
      target: target.cleanId,
      slug: 'bar',
    },
    ownerToken,
  ).then(r => r.expectNoGraphQLErrors());

  expect(renameResult.updateTargetSlug.error).toBeNull();
  expect(renameResult.updateTargetSlug.ok?.target.name).toBe('bar');
  expect(renameResult.updateTargetSlug.ok?.target.cleanId).toBe('bar');
  expect(renameResult.updateTargetSlug.ok?.selector.target).toBe('bar');
});

test.concurrent(
  `changing a target's slug to the same value should keep the same slug`,
  async ({ expect }) => {
    const { createOrg, ownerToken } = await initSeed().createOwner();
    const { createProject, organization } = await createOrg();
    const { project, target } = await createProject(ProjectType.Single);

    const renameResult = await updateTargetSlug(
      {
        organization: organization.cleanId,
        project: project.cleanId,
        target: target.cleanId,
        slug: target.cleanId,
      },
      ownerToken,
    ).then(r => r.expectNoGraphQLErrors());

    expect(renameResult.updateTargetSlug.error).toBeNull();
    expect(renameResult.updateTargetSlug.ok?.target.name).toBe(target.cleanId);
    expect(renameResult.updateTargetSlug.ok?.target.cleanId).toBe(target.cleanId);
    expect(renameResult.updateTargetSlug.ok?.selector.target).toBe(target.cleanId);
  },
);

test.concurrent(
  `changing a target's slug to a taken value should result in an error`,
  async ({ expect }) => {
    const { createOrg, ownerToken } = await initSeed().createOwner();
    const { createProject, organization, projects } = await createOrg();
    const { project, targets } = await createProject(ProjectType.Single);

    const firstTarget = targets[0];
    const secondTarget = targets[1];

    expect(firstTarget).toBeDefined();
    expect(secondTarget).toBeDefined();

    const renameResult = await updateTargetSlug(
      {
        organization: organization.cleanId,
        project: project.cleanId,
        target: firstTarget.cleanId,
        slug: secondTarget.cleanId,
      },
      ownerToken,
    ).then(r => r.expectNoGraphQLErrors());

    expect(renameResult.updateTargetSlug.ok).toBeNull();
    expect(renameResult.updateTargetSlug.error?.message).toBe('Target slug is already taken');
  },
);

test.concurrent(
  `changing a target's slug to a slug taken by another project should be possible`,
  async ({ expect }) => {
    const { createOrg, ownerToken } = await initSeed().createOwner();
    const { createProject, organization } = await createOrg();
    const { project, target } = await createProject(ProjectType.Single);
    const { targets, project: project2 } = await createProject(ProjectType.Single);

    const target2 = targets.find(t => t.cleanId !== target.cleanId)!;
    expect(target2).toBeDefined();

    const sharedSlug = 'foo';

    await updateTargetSlug(
      {
        organization: organization.cleanId,
        project: project2.cleanId,
        target: target2.cleanId,
        slug: sharedSlug,
      },
      ownerToken,
    ).then(r => r.expectNoGraphQLErrors());

    const renameResult = await updateTargetSlug(
      {
        organization: organization.cleanId,
        project: project.cleanId,
        target: target.cleanId,
        slug: sharedSlug,
      },
      ownerToken,
    ).then(r => r.expectNoGraphQLErrors());

    expect(renameResult.updateTargetSlug.error).toBeNull();
    expect(renameResult.updateTargetSlug.ok?.target.name).toBe(sharedSlug);
    expect(renameResult.updateTargetSlug.ok?.target.cleanId).toBe(sharedSlug);
    expect(renameResult.updateTargetSlug.ok?.selector.target).toBe(sharedSlug);
  },
);

test.concurrent(
  `changing a targets's slug to "view" should result in an error`,
  async ({ expect }) => {
    const { createOrg, ownerToken } = await initSeed().createOwner();
    const { createProject, organization } = await createOrg();
    const { project, target } = await createProject(ProjectType.Single);

    const renameResult = await updateTargetSlug(
      {
        organization: organization.cleanId,
        project: project.cleanId,
        target: target.cleanId,
        slug: 'view',
      },
      ownerToken,
    ).then(r => r.expectNoGraphQLErrors());

    expect(renameResult.updateTargetSlug.ok).toBeNull();
    expect(renameResult.updateTargetSlug.error?.message).toBeDefined();
  },
);
