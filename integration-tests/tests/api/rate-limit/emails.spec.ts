import { TargetAccessScope, ProjectType, ProjectAccessScope, OrganizationAccessScope } from '@app/gql/graphql';
import { createOrganization, createProject, createToken, updateOrgRateLimit, waitFor } from '../../../testkit/flow';
import * as emails from '../../../testkit/emails';
import { authenticate } from '../../../testkit/auth';
import { collect } from '../../../testkit/usage';

test('rate limit approaching and reached for organization', async () => {
  const adminEmail = process.env.AUTH0_USER_ADMIN_EMAIL!;
  console.log('Authenticate admin');
  const { access_token } = await authenticate('admin');

  console.log('Create organization');
  const orgResult = await createOrganization(
    {
      name: 'foo',
    },
    access_token
  );

  const org = orgResult.body.data!.createOrganization.ok!.createdOrganizationPayload.organization;
  console.log('Create project');
  const projectResult = await createProject(
    {
      organization: org.cleanId,
      type: ProjectType.Single,
      name: 'bar',
    },
    access_token
  );

  const project = projectResult.body.data!.createProject.ok!.createdProject;
  const target = projectResult.body.data!.createProject.ok!.createdTargets.find(t => t.name === 'production')!;

  console.log('Update org rate limit');
  await updateOrgRateLimit(
    {
      organization: org.cleanId,
    },
    {
      operations: 11,
    },
    access_token
  );

  console.log('Create token');
  const tokenResult = await createToken(
    {
      name: 'test',
      organization: org.cleanId,
      project: project.cleanId,
      target: target.cleanId,
      organizationScopes: [OrganizationAccessScope.Read],
      projectScopes: [ProjectAccessScope.Read],
      targetScopes: [TargetAccessScope.Read, TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
    },
    access_token
  );

  expect(tokenResult.body.errors).not.toBeDefined();

  const token = tokenResult.body.data!.createToken.ok!.secret;

  const op = {
    operation: 'query ping { ping }',
    operationName: 'ping',
    fields: ['Query', 'Query.ping'],
    execution: {
      ok: true,
      duration: 200000000,
      errorsTotal: 0,
    },
  };

  console.log('Collect 10 operations');
  const collectResult = await collect({
    operations: new Array(10).fill(op),
    token,
  });

  expect(collectResult.status).toEqual(200);

  console.log('Wait for 5s');
  await waitFor(5_000);

  console.log('Fetch history of emails');
  let sent = await emails.history();
  expect(sent.length).toEqual(1);

  expect(sent).toContainEqual({
    to: adminEmail,
    subject: `${org.name} is approaching its rate limit`,
    body: expect.any(String),
  });

  console.log('Collect 2 operations');
  await collect({
    operations: [op, op],
    token,
  });

  console.log('Wait for 5s');
  await waitFor(5_000);

  console.log('Fetch history of emails');
  sent = await emails.history();
  expect(sent.length).toEqual(2);

  expect(sent).toContainEqual({
    to: adminEmail,
    subject: `${org.name} has exceeded its rate limit`,
    body: expect.any(String),
  });

  console.log('Collect 1 operation');
  // Make sure we don't send the same email again
  await collect({
    operations: [op, op],
    token,
  });

  console.log('Wait for 5s');
  await waitFor(5_000);

  console.log('Fetch history of emails');
  sent = await emails.history();
  expect(sent.length).toEqual(2);
  console.log('done');
});
