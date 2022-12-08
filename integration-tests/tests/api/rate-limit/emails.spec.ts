import {
  TargetAccessScope,
  ProjectType,
  ProjectAccessScope,
  OrganizationAccessScope,
} from '@app/gql/graphql';
import {
  createOrganization,
  createProject,
  createToken,
  updateOrgRateLimit,
  waitFor,
} from '../../../testkit/flow';
import * as emails from '../../../testkit/emails';
import { authenticate, userEmail } from '../../../testkit/auth';
import { collect } from '../../../testkit/usage';

function generateUnique() {
  return Math.random().toString(36).substring(7);
}

function filterEmailsByOrg(orgName: string, emails: emails.Email[]) {
  return emails
    .filter(email => email.subject.includes(orgName))
    .map(email => ({
      subject: email.subject,
      email: email.to,
    }));
}

test('rate limit approaching and reached for organization', async () => {
  const adminEmail = userEmail('admin');
  const { access_token } = await authenticate('admin');
  const orgResult = await createOrganization(
    {
      name: generateUnique(),
    },
    access_token,
  );

  const org = orgResult.body.data!.createOrganization.ok!.createdOrganizationPayload.organization;
  const projectResult = await createProject(
    {
      organization: org.cleanId,
      type: ProjectType.Single,
      name: 'bar',
    },
    access_token,
  );

  const project = projectResult.body.data!.createProject.ok!.createdProject;
  const target = projectResult.body.data!.createProject.ok!.createdTargets.find(
    t => t.name === 'production',
  )!;

  await updateOrgRateLimit(
    {
      organization: org.cleanId,
    },
    {
      operations: 11,
    },
    access_token,
  );

  const tokenResult = await createToken(
    {
      name: 'test',
      organization: org.cleanId,
      project: project.cleanId,
      target: target.cleanId,
      organizationScopes: [OrganizationAccessScope.Read],
      projectScopes: [ProjectAccessScope.Read],
      targetScopes: [
        TargetAccessScope.Read,
        TargetAccessScope.RegistryRead,
        TargetAccessScope.RegistryWrite,
      ],
    },
    access_token,
  );

  expect(tokenResult.body.errors).not.toBeDefined();

  const token = tokenResult.body.data!.createToken.ok!.secret;

  const op = {
    operation: 'query ping { ping }',
    operationName: 'ping',
    fields: ['Query', 'Query.ping'],
    execution: {
      ok: true,
      duration: 200_000_000,
      errorsTotal: 0,
    },
  };

  const collectResult = await collect({
    operations: new Array(10).fill(op),
    token,
  });

  expect(collectResult.status).toEqual(200);

  await waitFor(5000);

  let sent = await emails.history();
  expect(sent).toContainEqual({
    to: adminEmail,
    subject: `${org.name} is approaching its rate limit`,
    body: expect.any(String),
  });
  expect(filterEmailsByOrg(org.name, sent)).toHaveLength(1);

  await collect({
    operations: [op, op],
    token,
  });

  await waitFor(5000);

  sent = await emails.history();

  expect(sent).toContainEqual({
    to: adminEmail,
    subject: `GraphQL-Hive operations quota for ${org.name} exceeded`,
    body: expect.any(String),
  });
  expect(filterEmailsByOrg(org.name, sent)).toHaveLength(2);

  // Make sure we don't send the same email again
  await collect({
    operations: [op, op],
    token,
  });

  await waitFor(5000);

  // Nothing new
  sent = await emails.history();
  expect(filterEmailsByOrg(org.name, sent)).toHaveLength(2);
});
