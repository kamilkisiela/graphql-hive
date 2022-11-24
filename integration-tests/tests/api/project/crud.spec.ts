import { ProjectType } from '@app/gql/graphql';
import { createOrganization, createProject, renameProject } from '../../../testkit/flow';
import { authenticate } from '../../../testkit/auth';

test('creating a project should result in creating the development, staging and production targets', async () => {
  const { access_token } = await authenticate('main');
  const orgResult = await createOrganization(
    {
      name: 'foo',
    },
    access_token,
  );
  const org = orgResult.body.data!.createOrganization.ok!.createdOrganizationPayload.organization;

  const projectResult = await createProject(
    {
      organization: org.cleanId,
      type: ProjectType.Single,
      name: 'foo',
    },
    access_token,
  );

  const targets = projectResult.body.data!.createProject.ok!.createdTargets;

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
});

test('renaming a project should result changing its cleanId', async () => {
  const { access_token } = await authenticate('main');
  const orgResult = await createOrganization(
    {
      name: 'foo',
    },
    access_token,
  );
  const org = orgResult.body.data!.createOrganization.ok!.createdOrganizationPayload.organization;

  const projectResult = await createProject(
    {
      organization: org.cleanId,
      type: ProjectType.Single,
      name: 'foo',
    },
    access_token,
  );

  const project = projectResult.body.data!.createProject.ok!.createdProject;

  const renamedProjectResult = await renameProject(
    {
      organization: org.cleanId,
      project: project.cleanId,
      name: 'bar',
    },
    access_token,
  );

  expect(renamedProjectResult.body.errors).not.toBeDefined();
  expect(renamedProjectResult.body.data?.updateProjectName.error).toBeNull();
  expect(renamedProjectResult.body.data?.updateProjectName.ok?.updatedProject.name).toBe('bar');
  expect(renamedProjectResult.body.data?.updateProjectName.ok?.updatedProject.cleanId).toBe('bar');
  expect(renamedProjectResult.body.data?.updateProjectName.ok?.selector.project).toBe('bar');
});
