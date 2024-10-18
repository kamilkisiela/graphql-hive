import { ProjectType } from 'testkit/gql/graphql';
import { updateProjectSlug } from '../../../testkit/flow';
import { initSeed } from '../../../testkit/seed';

test.concurrent(
  'creating a project should result in creating the development, staging and production targets',
  async ({ expect }) => {
    const { createOrg } = await initSeed().createOwner();
    const { createProject } = await createOrg();
    const { targets } = await createProject(ProjectType.Single);

    expect(targets).toHaveLength(3);
    expect(targets).toContainEqual(
      expect.objectContaining({
        slug: 'development',
        name: 'development',
      }),
    );
    expect(targets).toContainEqual(
      expect.objectContaining({
        slug: 'staging',
        name: 'staging',
      }),
    );
    expect(targets).toContainEqual(
      expect.objectContaining({
        slug: 'production',
        name: 'production',
      }),
    );
  },
);

test.concurrent(`changing a project's slug should result changing its name`, async ({ expect }) => {
  const { createOrg, ownerToken } = await initSeed().createOwner();
  const { createProject, organization } = await createOrg();
  const { project } = await createProject(ProjectType.Single);

  const renameResult = await updateProjectSlug(
    {
      organizationSlug: organization.slug,
      projectSlug: project.slug,
      slug: 'bar',
    },
    ownerToken,
  ).then(r => r.expectNoGraphQLErrors());

  expect(renameResult.updateProjectSlug.error).toBeNull();
  expect(renameResult.updateProjectSlug.ok?.project.name).toBe('bar');
  expect(renameResult.updateProjectSlug.ok?.project.slug).toBe('bar');
  expect(renameResult.updateProjectSlug.ok?.selector.projectSlug).toBe('bar');
});

test.concurrent(
  `changing a project's slug to the same value should keep the same slug`,
  async ({ expect }) => {
    const { createOrg, ownerToken } = await initSeed().createOwner();
    const { createProject, organization } = await createOrg();
    const { project } = await createProject(ProjectType.Single);

    const renameResult = await updateProjectSlug(
      {
        organizationSlug: organization.slug,
        projectSlug: project.slug,
        slug: project.slug,
      },
      ownerToken,
    ).then(r => r.expectNoGraphQLErrors());

    expect(renameResult.updateProjectSlug.error).toBeNull();
    expect(renameResult.updateProjectSlug.ok?.project.name).toBe(project.slug);
    expect(renameResult.updateProjectSlug.ok?.project.slug).toBe(project.slug);
    expect(renameResult.updateProjectSlug.ok?.selector.projectSlug).toBe(project.slug);
  },
);

test.concurrent(
  `changing a project's slug to a taken value should result in an error`,
  async ({ expect }) => {
    const { createOrg, ownerToken } = await initSeed().createOwner();
    const { createProject, organization, projects } = await createOrg();
    const { project } = await createProject(ProjectType.Single);
    const { project: project2 } = await createProject(ProjectType.Single);

    const renameResult = await updateProjectSlug(
      {
        organizationSlug: organization.slug,
        projectSlug: project.slug,
        slug: project2.slug,
      },
      ownerToken,
    ).then(r => r.expectNoGraphQLErrors());

    expect(renameResult.updateProjectSlug.ok).toBeNull();
    expect(renameResult.updateProjectSlug.error?.message).toBe('Project slug is already taken');

    // Ensure the project slug was not changed
    await expect(projects()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: project.id,
          slug: project.slug,
          name: project.slug,
        }),
        expect.objectContaining({
          id: project2.id,
          slug: project2.slug,
          name: project2.slug,
        }),
      ]),
    );
  },
);

test.concurrent(
  `changing a project's slug to a slug taken by another organization should be possible`,
  async ({ expect }) => {
    const { createOrg, ownerToken } = await initSeed().createOwner();
    const { createProject, organization, projects } = await createOrg();
    const { createProject: createProject2, organization: organization2 } = await createOrg();
    const { project } = await createProject(ProjectType.Single);
    const { project: project2 } = await createProject2(ProjectType.Single);

    const renameResult = await updateProjectSlug(
      {
        organizationSlug: organization.slug,
        projectSlug: project.slug,
        slug: project2.slug,
      },
      ownerToken,
    ).then(r => r.expectNoGraphQLErrors());

    expect(renameResult.updateProjectSlug.error).toBeNull();
    expect(renameResult.updateProjectSlug.ok?.project.name).toBe(project2.slug);
    expect(renameResult.updateProjectSlug.ok?.project.slug).toBe(project2.slug);
    expect(renameResult.updateProjectSlug.ok?.selector.projectSlug).toBe(project2.slug);
  },
);

test.concurrent(
  `changing a project's slug to "view" should result in an error`,
  async ({ expect }) => {
    const { createOrg, ownerToken } = await initSeed().createOwner();
    const { createProject, organization } = await createOrg();
    const { project } = await createProject(ProjectType.Single);

    const renameResult = await updateProjectSlug(
      {
        organizationSlug: organization.slug,
        projectSlug: project.slug,
        slug: 'view',
      },
      ownerToken,
    ).then(r => r.expectNoGraphQLErrors());

    expect(renameResult.updateProjectSlug.ok).toBeNull();
    expect(renameResult.updateProjectSlug.error?.message).toBeDefined();
  },
);

test.concurrent(
  `changing a project's slug to "new" should result in an error`,
  async ({ expect }) => {
    const { createOrg, ownerToken } = await initSeed().createOwner();
    const { createProject, organization } = await createOrg();
    const { project } = await createProject(ProjectType.Single);

    const renameResult = await updateProjectSlug(
      {
        organizationSlug: organization.slug,
        projectSlug: project.slug,
        slug: 'new',
      },
      ownerToken,
    ).then(r => r.expectNoGraphQLErrors());

    expect(renameResult.updateProjectSlug.ok).toBeNull();
    expect(renameResult.updateProjectSlug.error?.message).toBeDefined();
  },
);

test.concurrent(
  `changing a project's slug to "new" should result in an error`,
  async ({ expect }) => {
    const { createOrg, ownerToken } = await initSeed().createOwner();
    const { createProject, organization } = await createOrg();
    const { project } = await createProject(ProjectType.Single);

    const renameResult = await updateProjectSlug(
      {
        organizationSlug: organization.slug,
        projectSlug: project.slug,
        slug: 'new',
      },
      ownerToken,
    ).then(r => r.expectNoGraphQLErrors());

    expect(renameResult.updateProjectSlug.ok).toBeNull();
    expect(renameResult.updateProjectSlug.error?.message).toBeDefined();
  },
);
