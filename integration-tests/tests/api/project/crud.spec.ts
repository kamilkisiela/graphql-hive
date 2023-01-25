import { ProjectType } from '@app/gql/graphql';
import { renameProject } from '../../../testkit/flow';
import { initSeed } from '../../../testkit/seed';

test.concurrent(
  'creating a project should result in creating the development, staging and production targets',
  async () => {
    const { createOrg } = await initSeed().createOwner();
    const { createProject } = await createOrg();
    const { targets } = await createProject(ProjectType.Single);

    expect(targets).toHaveLength(3);
    expect(targets).toContainEqual(
      expect.objectContaining({
        cleanId: 'development',
        name: 'development',
      }),
    );
    expect(targets).toContainEqual(
      expect.objectContaining({
        cleanId: 'staging',
        name: 'staging',
      }),
    );
    expect(targets).toContainEqual(
      expect.objectContaining({
        cleanId: 'production',
        name: 'production',
      }),
    );
  },
);

test.concurrent('renaming a project should result changing its cleanId', async () => {
  const { createOrg, ownerToken } = await initSeed().createOwner();
  const { createProject, organization } = await createOrg();
  const { project } = await createProject(ProjectType.Single);

  const renamedProjectResult = await renameProject(
    {
      organization: organization.cleanId,
      project: project.cleanId,
      name: 'bar',
    },
    ownerToken,
  ).then(r => r.expectNoGraphQLErrors());

  expect(renamedProjectResult.updateProjectName.error).toBeNull();
  expect(renamedProjectResult.updateProjectName.ok?.updatedProject.name).toBe('bar');
  expect(renamedProjectResult.updateProjectName.ok?.updatedProject.cleanId).toBe('bar');
  expect(renamedProjectResult.updateProjectName.ok?.selector.project).toBe('bar');
});
