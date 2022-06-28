import { ProjectType } from '@app/gql/graphql';
import { createOrganization, createProject } from '../../../testkit/flow';
import { authenticate } from '../../../testkit/auth';

test('creating a project should result in creating the development, staging and production targets', async () => {
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

  const targets = projectResult.body.data!.createProject.ok!.createdTargets;

  expect(targets).toHaveLength(3);
  expect(targets).toContainEqual(
    expect.objectContaining({
      name: 'development',
    })
  );
  expect(targets).toContainEqual(
    expect.objectContaining({
      name: 'staging',
    })
  );
  expect(targets).toContainEqual(
    expect.objectContaining({
      name: 'production',
    })
  );
});
