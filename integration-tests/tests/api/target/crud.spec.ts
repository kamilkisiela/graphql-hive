import { ProjectType } from '@app/gql/graphql';
import { createOrganization, createProject, renameTarget } from '../../../testkit/flow';
import { authenticate } from '../../../testkit/auth';

test('renaming a project should result changing its cleanId', async () => {
  const { access_token } = await authenticate('main');
  const orgResult = await createOrganization(
    {
      name: 'foo',
    },
    access_token
  );
  const org = orgResult.body.data!.createOrganization.ok!.createdOrganizationPayload.organization;

  const projectResult = await createProject(
    {
      organization: org.cleanId,
      type: ProjectType.Single,
      name: 'foo',
    },
    access_token
  );

  const project = projectResult.body.data!.createProject.ok!.createdProject;
  const target = projectResult.body.data?.createProject.ok?.createdTargets.find(t => t.name === 'production');

  expect(target).toBeDefined();

  const renamedTargetResult = await renameTarget(
    {
      organization: org.cleanId,
      project: project.cleanId,
      target: target!.cleanId,
      name: 'bar',
    },
    access_token
  );

  expect(renamedTargetResult.body.errors).not.toBeDefined();

  expect(renamedTargetResult.body.data?.updateTargetName.error).toBeNull();
  expect(renamedTargetResult.body.data?.updateTargetName.ok?.updatedTarget.name).toBe('bar');
  expect(renamedTargetResult.body.data?.updateTargetName.ok?.updatedTarget.cleanId).toBe('bar');
  expect(renamedTargetResult.body.data?.updateTargetName.ok?.selector.target).toBe('bar');
});
