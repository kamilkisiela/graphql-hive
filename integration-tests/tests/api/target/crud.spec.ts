import { ProjectType } from '@app/gql/graphql';
import { renameTarget } from '../../../testkit/flow';
import { initSeed } from '../../../testkit/seed';

test.concurrent('renaming a target should result changing its cleanId', async () => {
  const { createOrg, ownerToken } = await initSeed().createOwner();
  const { organization, createProject } = await createOrg();
  const { project, target } = await createProject(ProjectType.Single);

  const renamedTargetResult = await renameTarget(
    {
      organization: organization.cleanId,
      project: project.cleanId,
      target: target.cleanId,
      name: 'bar',
    },
    ownerToken,
  ).then(r => r.expectNoGraphQLErrors());

  expect(renamedTargetResult.updateTargetName.error).toBeNull();
  expect(renamedTargetResult.updateTargetName.ok?.updatedTarget.name).toBe('bar');
  expect(renamedTargetResult.updateTargetName.ok?.updatedTarget.cleanId).toBe('bar');
  expect(renamedTargetResult.updateTargetName.ok?.selector.target).toBe('bar');
});
